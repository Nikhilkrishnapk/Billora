import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { CalendarDays, CalendarRange, ChevronRight, Plus, ReceiptText, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { useDraftBill } from '../context/DraftBillContext';
import { Banner, Card } from '../components/ui';
import { WeekChart } from '../components/WeekChart';
import { formatAmount, formatLongDate, formatTime } from '../lib/format';
import { quickRange } from '../lib/dateRanges';
import { dailyStats, rangeStats, recentBills, type DayStat } from '../services/billService';
import { currentUid, friendlyError } from '../services/firebase';
import { colors, fonts, radius, space, type } from '../config/theme';
import type { TabScreen } from '../navigation/types';
import type { Bill } from '../types';

interface Dashboard {
  /** Null when the totals could not be loaded (offline, or the server is still building its index). */
  days: DayStat[] | null;
  month: { count: number; total: number } | null;
  recent: Bill[];
}

function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('') || 'B';

const billsLabel = (n: number) => `${n} bill${n === 1 ? '' : 's'}`;

/** Home dashboard: today's takings, Add Bill, week/month tiles, 7-day chart, last 3 bills. */
export function HomeScreen({ navigation }: TabScreen<'Home'>) {
  const { profile } = useApp();
  const draft = useDraftBill();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setError(null);
    try {
      const uid = currentUid();
      // Each part loads on its own, so recent bills still show if the totals fail (and vice versa).
      let statsError: unknown = null;
      const [days, month, recent] = await Promise.all([
        dailyStats(uid, 7).catch(e => {
          statsError = e;
          return null;
        }),
        rangeStats(uid, quickRange('month')).catch(() => null),
        recentBills(uid, 3),
      ]);
      if (id !== requestId.current) return;
      setData({ days, month, recent });
      if (statsError) setError(`Couldn't load your totals. ${friendlyError(statsError)}`);
    } catch (e) {
      if (id === requestId.current) setError(friendlyError(e));
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Refresh on every visit so a bill saved a moment ago shows up straight away.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const addBill = () => {
    if (!draft.isDirty) draft.reset();
    navigation.navigate('CreateBill');
  };

  const days = data?.days ?? null;
  const today = days?.[days.length - 1];
  const yesterday = days?.[days.length - 2];
  const weekStart = quickRange('week').start;
  const week = days?.filter(d => d.day >= weekStart).reduce((a, d) => ({ count: a.count + d.count, total: a.total + d.total }), { count: 0, total: 0 });
  const avg = today && today.count > 0 ? today.total / today.count : 0;
  const change = today && yesterday && yesterday.total > 0 ? ((today.total - yesterday.total) / yesterday.total) * 100 : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={type.caption}>
              {greeting()}, {profile?.ownerName?.split(' ')[0] || 'there'}
            </Text>
            <Text style={[type.tabTitle, { marginTop: 2 }]} numberOfLines={1} accessibilityRole="header">
              {profile?.companyName}
            </Text>
            <Text style={[type.caption, { marginTop: 2 }]}>{formatLongDate(new Date())}</Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Profile')}
            style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Open profile">
            <Text style={styles.avatarText}>{initials(profile?.ownerName ?? '')}</Text>
          </Pressable>
        </View>

        {/* Today summary + Add Bill */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>Today's revenue</Text>
            {change !== null ? (
              <View style={styles.trend} accessibilityLabel={`${Math.abs(change).toFixed(0)} percent ${change >= 0 ? 'up' : 'down'} from yesterday`}>
                {change >= 0 ? <TrendingUp size={14} color={colors.white} /> : <TrendingDown size={14} color={colors.white} />}
                <Text style={styles.trendText}>
                  {change >= 0 ? '+' : '−'}
                  {Math.abs(change).toFixed(0)}% vs yesterday
                </Text>
              </View>
            ) : null}
          </View>
          {loading && !data ? (
            <ActivityIndicator color={colors.white} style={{ alignSelf: 'flex-start', marginVertical: 14 }} />
          ) : (
            <Text style={styles.heroValue} adjustsFontSizeToFit numberOfLines={1}>
              {today ? `₹${formatAmount(today.total)}` : '—'}
            </Text>
          )}
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{today ? today.count : '—'}</Text>
              <Text style={styles.heroStatLabel}>Bills today</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{today ? `₹${formatAmount(avg)}` : '—'}</Text>
              <Text style={styles.heroStatLabel}>Average bill</Text>
            </View>
          </View>
          <Pressable
            onPress={addBill}
            style={({ pressed }) => [styles.addBill, pressed && { backgroundColor: colors.primaryTint }]}
            accessibilityRole="button"
            accessibilityLabel="Add bill">
            <View style={styles.addIcon}>
              <Plus size={20} color={colors.white} strokeWidth={2.75} />
            </View>
            <Text style={styles.addText}>Add Bill</Text>
          </Pressable>
        </View>

        {error ? <Banner kind="error" text={error} style={{ marginBottom: 0 }} /> : null}

        {/* Week / month tiles */}
        <View style={styles.tiles}>
          <StatTile
            icon={<CalendarDays size={18} color={colors.primary} />}
            label="This week"
            value={week ? `₹${formatAmount(week.total)}` : '—'}
            sub={week ? billsLabel(week.count) : ' '}
            onPress={() => navigation.navigate('History', { filter: 'week' })}
          />
          <StatTile
            icon={<CalendarRange size={18} color={colors.primary} />}
            label="This month"
            value={data?.month ? `₹${formatAmount(data.month.total)}` : '—'}
            sub={data?.month ? billsLabel(data.month.count) : ' '}
            onPress={() => navigation.navigate('History', { filter: 'month' })}
          />
        </View>

        {/* Last 7 days */}
        <Card>
          <View style={styles.cardHead}>
            <Text style={type.cardTitle} accessibilityRole="header">
              Last 7 days
            </Text>
            <Text style={type.caption}>Tap a day</Text>
          </View>
          {days ? <WeekChart days={days} /> : <ChartPlaceholder loading={loading} />}
        </Card>

        {/* Recent bills */}
        <Card>
          <View style={styles.cardHead}>
            <Text style={type.cardTitle} accessibilityRole="header">
              Recent bills
            </Text>
            <Pressable
              onPress={() => navigation.navigate('History', { filter: 'month' })}
              style={({ pressed }) => [styles.more, pressed && { backgroundColor: colors.primaryTint }]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="See all bills in Transaction history">
              <Text style={styles.moreText}>See all</Text>
              <ChevronRight size={16} color={colors.primary} />
            </Pressable>
          </View>
          {!data ? (
            loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: space.lg }} /> : null
          ) : data.recent.length === 0 ? (
            <View style={styles.emptyBills}>
              <ReceiptText size={28} color={colors.textSecondary} />
              <Text style={[type.body, { color: colors.textSecondary, marginTop: space.sm, textAlign: 'center' }]}>
                No bills yet. Tap Add Bill to create your first one.
              </Text>
            </View>
          ) : (
            data.recent.map((b, i) => (
              <Pressable
                key={b.billId}
                onPress={() => navigation.navigate('BillView', { billId: b.billId, mode: 'detail' })}
                style={({ pressed }) => [styles.billRow, i > 0 && styles.billRowBorder, pressed && { backgroundColor: colors.background }]}
                accessibilityRole="button"
                accessibilityLabel={`${b.billNumber}, ${b.customerName}, ${formatAmount(b.grandTotal)} rupees`}>
                <View style={styles.billIcon}>
                  <ReceiptText size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.bodyStrong} numberOfLines={1}>
                    {b.customerName}
                  </Text>
                  <Text style={type.caption} numberOfLines={1}>
                    {b.billNumber} · {sameDay(b.billDatetime, new Date()) ? 'Today' : formatShort(b.billDatetime)}, {formatTime(b.billDatetime)}
                  </Text>
                </View>
                <Text style={styles.billAmount}>₹{formatAmount(b.grandTotal)}</Text>
              </Pressable>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatShort = (d: Date) => `${d.getDate()} ${MONTH[d.getMonth()]}`;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function StatTile({ icon, label, value, sub, onPress }: { icon: React.ReactNode; label: string; value: string; sub: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { backgroundColor: colors.primaryTint }]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}, ${sub}. Open in history`}>
      <View style={styles.tileHead}>
        <View style={styles.tileIcon}>{icon}</View>
        <ChevronRight size={16} color={colors.textSecondary} />
      </View>
      <Text style={[type.caption, { marginTop: space.md }]}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={type.caption}>{sub}</Text>
    </Pressable>
  );
}

function ChartPlaceholder({ loading }: { loading: boolean }) {
  return (
    <View style={{ height: 190, alignItems: 'center', justifyContent: 'center' }}>
      {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={type.caption}>Couldn't load the chart. Pull down to try again.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.xs },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bold, fontSize: 17, color: colors.primaryDark },

  hero: { backgroundColor: colors.primary, borderRadius: radius.sheet, padding: space.xl },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  heroLabel: { fontFamily: fonts.semibold, fontSize: 14, color: '#CFE6DB' },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radius.chip, paddingHorizontal: 10, paddingVertical: 4 },
  trendText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.white },
  heroValue: { fontFamily: fonts.bold, fontSize: 36, color: colors.white, marginTop: space.xs },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: space.lg, backgroundColor: colors.primaryDark, borderRadius: radius.card, paddingVertical: space.md },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontFamily: fonts.bold, fontSize: 17, color: colors.white },
  heroStatLabel: { fontFamily: fonts.medium, fontSize: 12, color: '#CFE6DB', marginTop: 2 },
  heroDivider: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.18)' },
  addBill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.white,
    borderRadius: radius.button,
    paddingVertical: 14,
    marginTop: space.lg,
  },
  addIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  addText: { fontFamily: fonts.bold, fontSize: 17, color: colors.primary },

  tiles: { flexDirection: 'row', gap: space.md },
  tile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.divider, padding: space.lg },
  tileHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tileIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  tileValue: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, marginTop: 2 },

  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  more: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.chip },
  moreText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  billRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, marginHorizontal: -space.sm, paddingHorizontal: space.sm, borderRadius: 10 },
  billRowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  billIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  billAmount: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  emptyBills: { alignItems: 'center', paddingVertical: space.lg },
});
