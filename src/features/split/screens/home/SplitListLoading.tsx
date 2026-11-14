import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { t } from "../../../../i18n";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { screenStyles } from "../shared/styles";

export function SplitListLoading({ compact = false }: { compact?: boolean }) {
  const label = t("home.loadingSplits");
  return (
    <View testID="split-list-loading" style={styles.container}>
      <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }} accessible style={styles.indicator}>
        <ActivityIndicator color={PALETTE.primary} size="large" />
        <Text style={styles.label}>{label}</Text>
      </View>
      <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.cards}>
        {Array.from({ length: compact ? 1 : 4 }, (_, index) => (
          <View key={index} style={screenStyles.recentShadowWrap} testID="split-loading-card">
            <View style={[screenStyles.itemsListCard, styles.card]}>
              <View style={[styles.bar, styles.title]} />
              <View style={styles.tags}>
                <View style={[styles.bar, styles.tag]} />
                <View style={[styles.bar, styles.tag, { width: 68 }]} />
                <View style={[styles.bar, styles.tag, { width: 44 }]} />
              </View>
              <View style={styles.divider} />
              <View style={styles.bottom}>
                <View style={[styles.bar, styles.status]} />
                <View style={[styles.bar, styles.amount]} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20 },
  indicator: { alignItems: "center", gap: 8 },
  label: { color: PALETTE.onSurfaceVariant, fontFamily: FONTS.body, fontSize: 14 },
  cards: { gap: 13 },
  card: { gap: 8, paddingVertical: 14 },
  bar: { backgroundColor: PALETTE.surfaceContainerHighest, borderRadius: 999, height: 16 },
  title: { width: "42%" },
  tags: { flexDirection: "row", gap: 8 },
  tag: { width: 76, height: 16, backgroundColor: PALETTE.surfaceContainer },
  divider: { height: 1, backgroundColor: PALETTE.divider },
  bottom: { flexDirection: "row", justifyContent: "space-between" },
  status: { width: 65, height: 13 },
  amount: { width: 88, height: 13 },
});
