import { useEffect, useRef, type ReactNode } from "react";
import { Animated, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Text as TamaguiText } from "tamagui";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import { screenStyles } from "./styles";

const Text = TamaguiText as any;

export function BottomSheetFrame({
  visible,
  title,
  bottomInset,
  onDismiss,
  onDismissComplete,
  children,
  centeredTitle = false,
  titleFontSize = 22,
  overlayStyle,
  cardStyle,
  avoidKeyboard = false,
  animationType = "slide",
  swipeToDismiss = false,
  contentOverride,
}: {
  visible: boolean;
  title: string;
  bottomInset: number;
  onDismiss: () => void;
  onDismissComplete?: () => void;
  children: ReactNode;
  centeredTitle?: boolean;
  titleFontSize?: number;
  overlayStyle?: StyleProp<ViewStyle>;
  cardStyle?: StyleProp<ViewStyle>;
  avoidKeyboard?: boolean;
  animationType?: "none" | "slide" | "fade";
  swipeToDismiss?: boolean;
  contentOverride?: ReactNode;
}) {
  const { t } = useTranslation();
  const translateY = useRef(new Animated.Value(0)).current;
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && gesture.dy > Math.abs(gesture.dx),
    onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 60 || (gesture.dy > 20 && gesture.vy > 1)) {
        Animated.timing(translateY, { toValue: 500, duration: 180, useNativeDriver: true }).start(({ finished }) => {
          if (finished) dismissRef.current();
        });
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      }
    },
    onPanResponderTerminate: () => Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start(),
  })).current;
  useEffect(() => {
    if (visible) translateY.setValue(0);
  }, [visible, translateY]);
  const sheetContent = (
    <Animated.View
      style={[
        screenStyles.personPhotoSheet,
        { paddingBottom: Math.max(bottomInset, 16) },
        cardStyle,
        swipeToDismiss ? { transform: [{ translateY }] } : null,
      ]}
    >
      {swipeToDismiss ? (
        <View {...panResponder.panHandlers} style={{ paddingVertical: 10, marginTop: -10 }}>
          <View style={screenStyles.personPhotoSheetHandle} />
        </View>
      ) : <View style={screenStyles.personPhotoSheetHandle} />}
      {centeredTitle ? (
        <View style={screenStyles.formSheetHeader}>
          <Text fontFamily={FONTS.headlineBold} fontSize={titleFontSize} color={PALETTE.onSurface}>
            {title}
          </Text>
        </View>
      ) : (
        <Text fontFamily={FONTS.headlineBold} fontSize={titleFontSize} color={PALETTE.onSurface}>
          {title}
        </Text>
      )}
      {children}
    </Animated.View>
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType={animationType}
      statusBarTranslucent
      onRequestClose={onDismiss}
      onDismiss={onDismissComplete}
    >
      <View style={[screenStyles.personPhotoSheetOverlay, overlayStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("modal.dismissActionSheet")}
          style={screenStyles.personPhotoSheetBackdrop}
          onPress={onDismiss}
        />
        {contentOverride && avoidKeyboard ? (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {contentOverride}
          </KeyboardAvoidingView>
        ) : contentOverride ?? (avoidKeyboard ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ width: "100%", maxHeight: "96%", alignItems: "center" }}
          >
            {sheetContent}
          </KeyboardAvoidingView>
        ) : sheetContent)}
      </View>
    </Modal>
  );
}
