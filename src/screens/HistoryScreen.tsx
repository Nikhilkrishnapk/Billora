import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';
import { ChevronRight } from 'lucide-react-native';
import { Banner, Button, Chip } from '../components/ui';
import { BottomSheet } from '../components/BottomSheet';
import { customRange, dayKey, parseDayKey, quickRange, addDays, type DateRange, type QuickFilter } from '../lib/dateRanges';
import { formatAmount, formatDate, formatLongDate, formatTime } from '../lib/format';
import { listBills, rangeStats } from '../services/billService';
import { currentUid, friendlyError } from '../services/firebase';
import { colors, fonts, space, type } from '../config/theme';
import type { TabScreen } from '../navigation/types';
import type { Bill } from '../types';

const FILTERS: { key: Exclude<QuickFilter, 'custom'>; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
];

function rangeLabel(filter: QuickFilter, range: DateRange) {
  const last = addDays(range.end, -1);
  if (filter === 'today' || filter === 'yesterday') return formatLongDate(range.start);
  if (dayKey(range.start) === dayKey(last)) return formatDate(range.start);
  return `${formatDate(range.start)} – ${formatDate(last)}`;
}

/** PRD 11.1–11.2 */
export function HistoryScreen({ navigation, route }: TabScreen<'History'>) {
  const [filter, setFilter] = useState<QuickFilter>('today');
  const [range, setRange] = useState<DateRange>(() => quickRange('today'));
  const [bills, setBills] = useState<Bill[]>([]);
  const [stats, setStats] = useState<{ count: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pick, setPick] = useState<{ start?: string; end?: string }>({});
  const cursor = useRef<any>(null);
  const done = useRef(false);
  const requestId = useRef(0);

  const load = useCallback(async (r: DateRange) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    cursor.current = null;
    done.current = false;
    try {
      const uid = currentUid();
      const [page, s] = await Promise.all([listBills(uid, r), rangeStats(uid, r).catch(() => null)]);
      if (id !== requestId.current) return;
      setBills(page.bills);
      cursor.current = page.last;
      done.current = page.done;
      setStats(s ?? { count: page.bills.length, total: page.bills.reduce((a, b) => a + b.grandTotal, 0) });
    } catch (e) {
      if (id === requestId.current) setError(friendlyError(e));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  const loadMore = async () => {
    if (loading || loadingMore || done.current || !cursor.current) return;
    setLoadingMore(true);
    try {
      const page = await listBills(currentUid(), range, cursor.current);
      setBills(b => [...b, ...page.bills]);
      cursor.current = page.last;
      done.current = page.done;
    } catch {
      // keep what we have; the user can pull to refresh
    } finally {
      setLoadingMore(false);
    }
  };

  // Refresh on every visit, so newly saved bills appear. Quick ranges are recomputed (the date may have changed).
  useFocusEffect(
    useCallback(() => {
      const r = filter === 'custom' ? range : quickRange(filter);
      setRange(r);
      load(r);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter, load]),
  );

  useEffect(() => {
    if (filter === 'custom') load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  // Opened from Home with a period (e.g. "This month"): switch to it once, then clear the param
  // so later visits keep whatever filter the merchant picks here.
  const paramFilter = route.params?.filter;
  useEffect(() => {
    if (!paramFilter) return;
    setFilter(paramFilter);
    navigation.setParams({ filter: undefined });
  }, [paramFilter, navigation]);

  const chooseQuick = (f: Exclude<QuickFilter, 'custom'>) => setFilter(f);

  const applyCustom = () => {
    if (!pick.start) return;
    const r = customRange(parseDayKey(pick.start), parseDayKey(pick.end ?? pick.start));
    setPickerOpen(false);
    setFilter('custom');
    setRange(r);
  };

  // Group by date heading, newest first.
  const sections: { title: string; data: Bill[] }[] = [];
  for (const b of bills) {
    const title = formatLongDate(b.billDatetime);
    const last = sections[sections.length - 1];
    if (last?.title === title) last.data.push(b);
    else sections.push({ title, data: [b] });
  }

  const marked: Record<string, any> = {};
  if (pick.start) {
    const s = parseDayKey(pick.start);
    const e = parseDayKey(pick.end ?? pick.start);
    for (let d = s; d <= e; d = addDays(d, 1)) {
      const k = dayKey(d);
      marked[k] = {
        color: k === pick.start || k === (pick.end ?? pick.start) ? colors.primary : colors.primaryTint,
        textColor: k === pick.start || k === (pick.end ?? pick.start) ? colors.white : colors.text,
        startingDay: k === pick.start,
        endingDay: k === (pick.end ?? pick.start),
      };
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={[type.tabTitle, styles.title]} accessibilityRole="header">
        Transaction history
      </Text>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map(f => (
            <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => chooseQuick(f.key)} />
          ))}
          <Chip
            label="Custom range"
            selected={filter === 'custom'}
            onPress={() => {
              setPick(filter === 'custom' ? { start: dayKey(range.start), end: dayKey(addDays(range.end, -1)) } : {});
              setPickerOpen(true);
            }}
          />
        </ScrollView>
      </View>

      <View style={styles.summary}>
        <Text style={type.caption}>{rangeLabel(filter, range)}</Text>
        <Text style={styles.summaryText}>
          {stats ? `${stats.count} bill${stats.count === 1 ? '' : 's'} · ₹${formatAmount(stats.total)}` : '—'}
        </Text>
      </View>

      {error ? <Banner kind="error" text={error} style={{ marginHorizontal: space.lg }} /> : null}

      <SectionList
        sections={sections}
        keyExtractor={b => b.billId}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl, flexGrow: 1 }}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={loading && bills.length > 0} onRefresh={() => load(range)} tintColor={colors.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        renderSectionHeader={({ section }) => <Text style={[type.label, styles.sectionHead]}>{section.title}</Text>}
        renderItem={({ item, index, section }) => (
          <Pressable
            onPress={() => navigation.navigate('BillView', { billId: item.billId, mode: 'detail' })}
            style={({ pressed }) => [
              styles.row,
              index === 0 && styles.rowFirst,
              index === section.data.length - 1 && styles.rowLast,
              pressed && { backgroundColor: colors.background },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${item.billNumber}, ${item.customerName}, ${formatAmount(item.grandTotal)} rupees`}>
            <View style={{ flex: 1 }}>
              <Text style={[type.mono, { fontSize: 13 }]}>{item.billNumber}</Text>
              <Text style={[type.bodyStrong, { marginTop: 2 }]} numberOfLines={1}>
                {item.customerName}
              </Text>
              <Text style={type.caption}>
                {item.customerMobile} · {formatTime(item.billDatetime)}
              </Text>
            </View>
            <Text style={styles.amount}>₹{formatAmount(item.grandTotal)}</Text>
            <ChevronRight size={18} color={colors.textSecondary} />
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: space.xxl }} />
          ) : (
            <Text style={[type.body, styles.empty]}>No bills for this date.</Text>
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ margin: space.lg }} /> : undefined}
      />

      <BottomSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Custom range"
        footer={<Button title="Show bills" onPress={applyCustom} disabled={!pick.start} style={{ marginTop: space.md }} />}>
        <Text style={[type.caption, { marginBottom: space.sm }]}>
          {pick.start
            ? `${formatDate(parseDayKey(pick.start))}${pick.end ? ` – ${formatDate(parseDayKey(pick.end))}` : ' · tap an end date'}`
            : 'Tap a start date, then an end date'}
        </Text>
        <Calendar
          markingType="period"
          markedDates={marked}
          maxDate={dayKey(new Date())}
          onDayPress={d => {
            const k = d.dateString;
            setPick(p => (!p.start || p.end ? { start: k } : k < p.start ? { start: k, end: p.start } : { start: p.start, end: k }));
          }}
          theme={{
            todayTextColor: colors.primary,
            arrowColor: colors.primary,
            textDayFontFamily: fonts.medium,
            textMonthFontFamily: fonts.bold,
            textDayHeaderFontFamily: fonts.semibold,
          }}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  title: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.md },
  chips: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.md },
  summary: {
    marginHorizontal: space.lg,
    marginBottom: space.md,
    backgroundColor: colors.primaryTint,
    borderRadius: 14,
    padding: space.md,
  },
  summaryText: { fontFamily: fonts.bold, fontSize: 18, color: colors.primaryDark, marginTop: 2 },
  sectionHead: { marginTop: space.lg, marginBottom: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.divider,
  },
  rowFirst: { borderTopWidth: 1, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  rowLast: { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  amount: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  empty: { textAlign: 'center', marginTop: space.xxl, color: colors.textSecondary },
});
