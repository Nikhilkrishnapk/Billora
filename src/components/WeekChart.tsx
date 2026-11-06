/**
 * "Last 7 days" revenue bars for Home. One series, one hue (brand green), so no legend:
 * the card title names it. Tap a bar to read that day's revenue and bill count; today is
 * selected by default. Built from plain Views (no chart library needed).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatAmount } from '../lib/format';
import { colors, fonts, space, type } from '../config/theme';
import type { DayStat } from '../services/billService';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PLOT_HEIGHT = 120;

const dayTitle = (d: Date, isToday: boolean) => (isToday ? 'Today' : `${DAY[d.getDay()]}, ${d.getDate()} ${MONTH[d.getMonth()]}`);

export function WeekChart({ days }: { days: DayStat[] }) {
  const [selected, setSelected] = useState(days.length - 1);
  const max = Math.max(...days.map(d => d.total), 0);
  const sel = days[Math.min(selected, days.length - 1)];
  const isToday = (i: number) => i === days.length - 1;

  return (
    <View>
      {/* Read-out for the selected day (the chart's "tooltip"). */}
      <View style={styles.readout} accessibilityLiveRegion="polite">
        <Text style={type.caption}>{dayTitle(sel.day, isToday(days.indexOf(sel)))}</Text>
        <Text style={styles.readoutValue}>₹{formatAmount(sel.total)}</Text>
        <Text style={type.caption}>
          {sel.count} bill{sel.count === 1 ? '' : 's'}
        </Text>
      </View>

      <View style={styles.plot}>
        {days.map((d, i) => {
          const active = i === selected;
          const h = max > 0 ? Math.max((d.total / max) * PLOT_HEIGHT, d.total > 0 ? 6 : 0) : 0;
          return (
            <Pressable
              key={d.day.toISOString()}
              style={styles.slot}
              onPress={() => setSelected(i)}
              hitSlop={{ top: 8, bottom: 8 }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${dayTitle(d.day, isToday(i))}: ${formatAmount(d.total)} rupees, ${d.count} bills`}>
              <View style={styles.barArea}>
                {h > 0 ? (
                  <View style={[styles.bar, { height: h, opacity: active ? 1 : 0.38 }]} />
                ) : (
                  <View style={[styles.empty, active && { backgroundColor: colors.textSecondary }]} />
                )}
              </View>
              <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{isToday(i) ? 'Today' : DAY[d.day.getDay()]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { marginBottom: space.md },
  readoutValue: { fontFamily: fonts.bold, fontSize: 22, color: colors.text, marginVertical: 2 },
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  slot: { flex: 1, alignItems: 'center' },
  barArea: {
    height: PLOT_HEIGHT,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  bar: { width: '72%', maxWidth: 28, backgroundColor: colors.primary, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  empty: { width: '72%', maxWidth: 28, height: 2, borderRadius: 1, backgroundColor: colors.divider },
  dayLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary, marginTop: 6 },
  dayLabelActive: { fontFamily: fonts.bold, color: colors.text },
});
