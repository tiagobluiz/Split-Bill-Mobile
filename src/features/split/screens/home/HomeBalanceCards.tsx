import { View } from "react-native";
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

  return (
    <>
      <XStack gap="$4" alignItems="stretch">
        <View style={screenStyles.homeBalanceCardWrap}>
          <SectionCard>
            <View style={screenStyles.homeBalanceCardContent}>
              <Text
                fontFamily={FONTS.bodyBold}
                fontSize={11}
                color={PALETTE.success}
                textTransform="uppercase"
                letterSpacing={2}
              >
                {t("home.youAreOwed")}
              </Text>
              <Text
                fontFamily={FONTS.headlineBlack}
                fontSize={34}
                color={PALETTE.onSurface}
                letterSpacing={-1.5}
              >
                {formatAppMoney(
                  balances.owedCents,
                  balances.currency,
                  locale,
                  settings,
                )}
              </Text>
            </View>
          </SectionCard>
        </View>
        <View style={screenStyles.homeBalanceCardWrap}>
          <SectionCard>
            <View style={screenStyles.homeBalanceCardContent}>
              <Text
                fontFamily={FONTS.bodyBold}
                fontSize={11}
                color={PALETTE.primary}
                textTransform="uppercase"
                letterSpacing={2}
              >
                {t("home.youOwe")}
              </Text>
              <Text
                fontFamily={FONTS.headlineBlack}
                fontSize={34}
                color={PALETTE.onSurface}
                letterSpacing={-1.5}
              >
                {formatAppMoney(
                  balances.oweCents,
                  balances.currency,
                  locale,
                  settings,
                )}
              </Text>
            </View>
          </SectionCard>
        </View>
      </XStack>
      {showSeparator ? <View style={screenStyles.itemsSectionSeparator} /> : null}
    </>
  );
}
