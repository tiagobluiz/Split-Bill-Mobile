import { View } from "react-native";
import {
  Text as TamaguiText,
} from "tamagui";

import { FONTS, PALETTE } from "../../../../theme/palette";
import { screenStyles } from "../shared/styles";

const Text = TamaguiText as any;

export function HomeMainHeader({ topInset }: { topInset: number }) {
  return (
    <View style={screenStyles.mainTabHeaderWrap}>
      <View
        style={[
          screenStyles.stickyHomeHeader,
          { paddingTop: Math.max(topInset + 8, 18) },
        ]}
      >
        <View style={screenStyles.homeHeader}>
          <Text
            fontFamily={FONTS.headlineBlack}
            fontSize={28}
            color={PALETTE.primary}
            textTransform="uppercase"
            fontStyle="italic"
            letterSpacing={-1.2}
          >
            Split Bill
          </Text>
        </View>
      </View>
    </View>
  );
}
