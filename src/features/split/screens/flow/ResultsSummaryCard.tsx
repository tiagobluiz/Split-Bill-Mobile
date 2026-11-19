import { useState } from "react";
import { Pressable, StyleSheet, Text as NativeText, View, useWindowDimensions } from "react-native";
import { EllipsisVertical } from "lucide-react-native";
import { Text as TamaguiText, YStack as TamaguiYStack } from "tamagui";

import { FONTS, PALETTE } from "../../../../theme/palette";
import { screenStyles } from "../shared/styles";

const Text = TamaguiText as any;
const YStack = TamaguiYStack as any;

const MINIMUM_SIZE = 16;
const TOTAL_SIZE = 32;
const PAYMENT_SIZE = 23;
const MENU_GAP = 8;
const METRIC_GAP = 13;
const DIVIDER_SIZE = 1;

type SummaryAmount = {
  label: string;
  amount: string;
  detail: string;
};

type PaymentSummary = {
  actionLabel: string;
  onOpenActions: () => void;
  outstanding: SummaryAmount;
  received: SummaryAmount;
};

type Measurement = { key: string; width: number };
type Widths = { base?: number; minimum?: number };

function fitAmount(baseSize: number, widths: Widths, available: number) {
  const { base, minimum } = widths;
  if (!available || base === undefined || minimum === undefined || base <= available) {
    return baseSize;
  }
  if (minimum >= available) return MINIMUM_SIZE;

  // Round down to leave room for native text size and glyph rounding.
  return Math.floor(MINIMUM_SIZE + (baseSize - MINIMUM_SIZE) * (available - minimum) / (base - minimum));
}

export function ResultsSummaryCard({
  total,
  payment,
}: {
  total: SummaryAmount;
  payment?: PaymentSummary;
}) {
  const { fontScale } = useWindowDimensions();
  const [contentWidth, setContentWidth] = useState(0);
  const [measurements, setMeasurements] = useState<Record<string, Measurement>>({});

  const amounts = [
    { id: "total", value: total.amount, size: TOTAL_SIZE, style: styles.totalAmount },
    ...(payment ? [
      { id: "outstanding", value: payment.outstanding.amount, size: PAYMENT_SIZE, style: styles.amount },
      { id: "received", value: payment.received.amount, size: PAYMENT_SIZE, style: styles.amount },
    ] : []),
  ];
  const probes = amounts.flatMap((amount) =>
    [amount.size, MINIMUM_SIZE].map((size) => ({
      ...amount,
      fontSize: size,
      slot: `${amount.id}-${size}`,
      key: JSON.stringify([amount.id, size, fontScale, amount.value]),
    })),
  );
  const widthsFor = (id: string, baseSize: number): Widths => {
    const widthAt = (size: number) => {
      const probe = probes.find((entry) => entry.slot === `${id}-${size}`);
      const measurement = probe && measurements[probe.slot];
      return measurement?.key === probe?.key ? measurement?.width : undefined;
    };
    return { base: widthAt(baseSize), minimum: widthAt(MINIMUM_SIZE) };
  };

  const totalWidths = widthsFor("total", TOTAL_SIZE);
  const outstandingWidths = widthsFor("outstanding", PAYMENT_SIZE);
  const receivedWidths = widthsFor("received", PAYMENT_SIZE);
  const widthBesideMenu = payment
    ? Math.max(0, contentWidth - screenStyles.resultsHeroMenuButton.width - MENU_GAP)
    : contentWidth;
  const columnWidth = Math.max(0, (contentWidth - METRIC_GAP * 2 - DIVIDER_SIZE) / 2);
  const totalBelowMenu = Boolean(payment && contentWidth && (totalWidths.minimum ?? 0) > widthBesideMenu);
  const stackPayments = contentWidth > 0 &&
    Math.max(outstandingWidths.minimum ?? 0, receivedWidths.minimum ?? 0) > columnWidth;
  const paymentWidth = stackPayments ? contentWidth : columnWidth;

  const totalLabel = (
    <Text
      fontFamily={FONTS.bodyBold}
      fontSize={11}
      color="rgba(255,255,255,0.78)"
      textTransform="uppercase"
      letterSpacing={1.8}
    >
      {total.label}
    </Text>
  );
  const totalDetails = (
    <>
      <NativeText
        testID="results-summary-total"
        style={[styles.totalAmount, { fontSize: fitAmount(TOTAL_SIZE, totalWidths, totalBelowMenu ? contentWidth : widthBesideMenu) }]}
      >
        {total.amount}
      </NativeText>
      <Text fontFamily={FONTS.bodyMedium} fontSize={12} color="rgba(255,255,255,0.82)">
        {total.detail}
      </Text>
    </>
  );

  return (
    <View style={screenStyles.resultsHeroCard}>
      <View style={screenStyles.resultsHeroGlow} />
      <View
        testID="results-summary-content"
        onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}
      >
        <YStack gap="$1">
          <View style={styles.headerRow}>
            <YStack flex={1} minWidth={0} gap="$1">
              {totalLabel}
              {totalBelowMenu ? null : totalDetails}
            </YStack>
            {payment ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={payment.actionLabel}
                style={screenStyles.resultsHeroMenuButton}
                onPress={payment.onOpenActions}
              >
                <EllipsisVertical color={PALETTE.onPrimary} size={21} />
              </Pressable>
            ) : null}
          </View>
          {totalBelowMenu ? totalDetails : null}
        </YStack>
        {payment ? (
          <>
            <View style={screenStyles.resultsHeroDivider} />
            <View
              testID="results-summary-payments"
              style={[screenStyles.resultsHeroMetrics, styles.metrics, stackPayments && styles.stackedMetrics]}
            >
              <PaymentMetric
                id="outstanding"
                summary={payment.outstanding}
                fontSize={fitAmount(PAYMENT_SIZE, outstandingWidths, paymentWidth)}
                stacked={stackPayments}
              />
              <View style={stackPayments ? styles.stackedDivider : screenStyles.resultsHeroMetricDivider} />
              <PaymentMetric
                id="received"
                summary={payment.received}
                fontSize={fitAmount(PAYMENT_SIZE, receivedWidths, paymentWidth)}
                stacked={stackPayments}
              />
            </View>
          </>
        ) : null}
      </View>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.measureHost}
      >
        {probes.map(({ key, slot, value, fontSize, style }) => (
          <NativeText
            key={key}
            testID={`results-summary-measure-${slot}`}
            numberOfLines={1}
            style={[style, styles.measureText, { fontSize }]}
            onLayout={(event) => {
              const { width } = event.nativeEvent.layout;
              setMeasurements((current) =>
                current[slot]?.key === key && current[slot].width === width
                  ? current
                  : { ...current, [slot]: { key, width } },
              );
            }}
          >
            {value}
          </NativeText>
        ))}
      </View>
    </View>
  );
}

function PaymentMetric({
  id,
  summary,
  fontSize,
  stacked,
}: {
  id: string;
  summary: SummaryAmount;
  fontSize: number;
  stacked: boolean;
}) {
  return (
    <YStack flex={stacked ? undefined : 1} minWidth={0} gap="$1">
      <Text fontFamily={FONTS.bodyBold} fontSize={12} color="rgba(255,255,255,0.84)">
        {summary.label}
      </Text>
      <NativeText testID={`results-summary-${id}`} style={[styles.amount, { fontSize }]}>
        {summary.amount}
      </NativeText>
      <Text fontFamily={FONTS.bodyMedium} fontSize={11} color="rgba(255,255,255,0.78)">
        {summary.detail}
      </Text>
    </YStack>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: MENU_GAP },
  metrics: { flexDirection: "row", gap: METRIC_GAP },
  stackedMetrics: { flexDirection: "column", gap: 10 },
  stackedDivider: { height: DIVIDER_SIZE, backgroundColor: "rgba(255,255,255,0.36)" },
  amount: { fontFamily: FONTS.headlineBlack, color: PALETTE.onPrimary },
  totalAmount: { fontFamily: FONTS.headlineBlack, color: PALETTE.onPrimary, letterSpacing: -1.2 },
  measureHost: { position: "absolute", left: -10_000, width: 10_000, opacity: 0 },
  measureText: { alignSelf: "flex-start" },
});
