import { useMemo, useState } from "react";
import {
  StyleSheet,
  Text as NativeText,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import {
  Text as TamaguiText,
  XStack as TamaguiXStack,
} from "tamagui";

import { SectionCard } from "../../../../components/ui";
import type { AppSettings } from "../../../../storage/settings";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import { formatAppMoney } from "../shared/settlementUtils";
import type { HomeBalances } from "./homeTypes";
import { screenStyles } from "../shared/styles";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;

const AMOUNT_BASE_FONT_SIZE = 27;
const AMOUNT_MINIMUM_FONT_SCALE = 0.6;
const AMOUNT_MINIMUM_FONT_SIZE = AMOUNT_BASE_FONT_SIZE * AMOUNT_MINIMUM_FONT_SCALE;

type BalanceSide = "owed" | "owe";
type SideWidths = Record<BalanceSide, number>;

type BalanceCardProps = {
  side: BalanceSide;
  title: string;
  titleColor: string;
  amount: string;
  amountFontSize: number;
  onContentLayout: (side: BalanceSide, event: LayoutChangeEvent) => void;
};

function BalanceCard({
  side,
  title,
  titleColor,
  amount,
  amountFontSize,
  onContentLayout,
}: BalanceCardProps) {
  return (
    <View style={screenStyles.homeBalanceCardWrap}>
      <SectionCard fill testID={`home-balance-${side}-card`}>
        <View
          testID={`home-balance-${side}-content`}
          style={screenStyles.homeBalanceCardContent}
          onLayout={(event) => onContentLayout(side, event)}
        >
          <Text
            testID={`home-balance-${side}-title`}
            fontFamily={FONTS.bodyBold}
            fontSize={11}
            lineHeight={16}
            color={titleColor}
            textTransform="uppercase"
            letterSpacing={2}
            numberOfLines={2}
            textBreakStrategy="simple"
            android_hyphenationFrequency="none"
          >
            {title}
          </Text>
          <Text
            testID={`home-balance-${side}-amount`}
            fontFamily={FONTS.headlineBlack}
            fontSize={amountFontSize}
            color={PALETTE.onSurface}
            letterSpacing={-1.5}
            numberOfLines={1}
          >
            {amount}
          </Text>
        </View>
      </SectionCard>
    </View>
  );
}

export function HomeBalanceCards({
  balances,
  locale,
  settings,
  showSeparator = false,
}: {
  balances: HomeBalances;
  locale: string;
  settings: AppSettings;
  showSeparator?: boolean;
}) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const owedAmount = formatAppMoney(
    balances.owedCents,
    balances.currency,
    locale,
    settings,
  );
  const oweAmount = formatAppMoney(
    balances.oweCents,
    balances.currency,
    locale,
    settings,
  );
  const [contentWidths, setContentWidths] = useState<SideWidths>({ owed: 0, owe: 0 });
  const [measuredWidths, setMeasuredWidths] = useState<SideWidths>({ owed: 0, owe: 0 });

  const amountFontSize = useMemo(() => {
    const availableWidths = Object.values(contentWidths).filter((width) => width > 0);
    const amountWidths = Object.values(measuredWidths).filter((width) => width > 0);
    if (availableWidths.length < 2 || amountWidths.length < 2) {
      return AMOUNT_BASE_FONT_SIZE;
    }

    const availableWidth = Math.min(...availableWidths);
    const widestAmount = Math.max(...amountWidths);
    const fittedSize = Math.floor(
      AMOUNT_BASE_FONT_SIZE * (availableWidth / widestAmount) * 10,
    ) / 10;
    return Math.max(
      AMOUNT_MINIMUM_FONT_SIZE,
      Math.min(AMOUNT_BASE_FONT_SIZE, fittedSize),
    );
  }, [contentWidths, measuredWidths]);

  const updateWidth = (
    setter: React.Dispatch<React.SetStateAction<SideWidths>>,
    side: BalanceSide,
    width: number,
  ) => {
    setter((current) => current[side] === width ? current : { ...current, [side]: width });
  };

  const handleContentLayout = (side: BalanceSide, event: LayoutChangeEvent) => {
    updateWidth(setContentWidths, side, event.nativeEvent.layout.width);
  };

  return (
    <>
      <XStack gap="$4" alignItems="stretch">
        <BalanceCard
          side="owed"
          title={t("home.youAreOwed")}
          titleColor={PALETTE.success}
          amount={owedAmount}
          amountFontSize={amountFontSize}
          onContentLayout={handleContentLayout}
        />
        <BalanceCard
          side="owe"
          title={t("home.youOwe")}
          titleColor={PALETTE.primary}
          amount={oweAmount}
          amountFontSize={amountFontSize}
          onContentLayout={handleContentLayout}
        />
      </XStack>
      <View pointerEvents="none" accessible={false} style={styles.measureHost}>
        {(["owed", "owe"] as const).map((side) => (
          <NativeText
            key={side}
            testID={`home-balance-${side}-measure`}
            accessible={false}
            allowFontScaling={false}
            numberOfLines={1}
            style={[
              styles.measureText,
              { fontSize: AMOUNT_BASE_FONT_SIZE * fontScale },
            ]}
            onTextLayout={(event) => {
              const width = event.nativeEvent.lines[0]?.width;
              if (typeof width === "number") {
                updateWidth(setMeasuredWidths, side, width);
              }
            }}
          >
            {side === "owed" ? owedAmount : oweAmount}
          </NativeText>
        ))}
      </View>
      {showSeparator ? <View style={screenStyles.itemsSectionSeparator} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  measureHost: {
    position: "absolute",
    left: -10_000,
    width: 10_000,
    opacity: 0,
  },
  measureText: {
    alignSelf: "flex-start",
    fontFamily: FONTS.headlineBlack,
    fontSize: AMOUNT_BASE_FONT_SIZE,
    letterSpacing: -1.5,
  },
});
