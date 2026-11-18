import { useState, type RefObject } from "react";
import { Keyboard, Pressable, StyleSheet, Text as NativeText, TextInput, useWindowDimensions, View } from "react-native";
import { AlertTriangle, Minus, Plus, Tag, Trash2 } from "lucide-react-native";
import { Text as TamaguiText } from "tamagui";

import { FieldLabel } from "../../../../components/ui";
import { formatMoney, getItemTotalCents, ITEM_QUANTITY_MAX, parseMoneyToCents, validateItemPricing } from "../../../../domain";
import type { ItemFormValue } from "../../../../domain";
import { useTranslation } from "../../../../i18n/provider";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { screenStyles } from "../shared/styles";

const Text = TamaguiText as any;
type Props = { item: ItemFormValue; currency: string; onChange: (item: ItemFormValue) => void };

export function limitDecimalPlaces(value: string) {
  return value.replace(/^(-?\d*[.,]\d{2})\d+$/, "$1");
}

export function clampItemDiscount(item: ItemFormValue): ItemFormValue {
  const discount = item.discount;
  if (!discount || !/^\d+(?:[.,]\d*)?$/.test(discount.value.trim())) return item;

  let maximum: number;
  if (discount.type === "percent") {
    maximum = 100;
  } else {
    const unit = parseMoneyToCents(item.price);
    const quantity = item.quantity ?? 1;
    if (unit === null || unit <= 0 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > ITEM_QUANTITY_MAX || !Number.isSafeInteger(unit * quantity)) return item;
    maximum = unit * quantity / 100;
  }

  if (Number(discount.value.trim().replace(",", ".")) <= maximum) return item;
  const value = discount.type === "percent" ? "100" : maximum.toFixed(2);
  return { ...item, discount: { ...discount, value } };
}

function formatEditableAmount(value: string, locale: string) {
  const cents = parseMoneyToCents(value);
  if (cents === null || !Number.isSafeInteger(cents)) return value;
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}

export function getItemCurrencySymbol(currency: string, locale: string, customSymbol?: string) {
  if (customSymbol) return customSymbol;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0).find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

export function ItemPriceRow({ item, currency, locale, onChange, placeholder, priceInputRef, onPriceChange }: Props & {
  locale: string;
  placeholder: string;
  priceInputRef: RefObject<TextInput | null>;
  onPriceChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [priceFocused, setPriceFocused] = useState(false);
  const quantity = item.quantity ?? 1;
  const displayPrice = priceFocused ? item.price : formatEditableAmount(item.price, locale);
  return (
    <View style={styles.priceRow}>
      <View style={styles.priceColumn}>
        <FieldLabel>{t("flow.itemDetail.price")}</FieldLabel>
        <View style={[screenStyles.assignInputShell, styles.priceInputShell]}>
          <TextInput
            ref={priceInputRef}
            accessibilityLabel={t("flow.itemDetail.priceA11y")}
            value={displayPrice}
            onFocus={() => setPriceFocused(true)}
            onBlur={() => setPriceFocused(false)}
            onChangeText={(value) => {
              setPriceFocused(true);
              onPriceChange(limitDecimalPlaces(value));
            }}
            onSubmitEditing={() => Keyboard.dismiss()}
            placeholder={placeholder}
            placeholderTextColor={PALETTE.inputPlaceholder}
            keyboardType="decimal-pad"
            returnKeyType="done"
            style={[styles.priceInput, { fontSize: Math.max(10, 19 - Math.max(0, displayPrice.length - 10)) }]}
          />
          <Text style={styles.currency}>{currency}</Text>
        </View>
      </View>
      <Text style={styles.multiply}>×</Text>
      <View style={styles.quantityColumn}>
        <FieldLabel>{t("flow.itemDetail.quantity")}</FieldLabel>
        <View style={styles.quantityShell}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("flow.itemDetail.decreaseQuantity")} accessibilityState={{ disabled: quantity <= 1 }} disabled={quantity <= 1} onPress={() => onChange({ ...item, quantity: Math.max(1, quantity - 1) })} style={styles.quantityButton}>
            <View style={styles.minusButton}>
            <Minus size={20} color={PALETTE.onSurface} />
            </View>
          </Pressable>
          <TextInput accessibilityLabel={t("flow.itemDetail.quantity")} keyboardType="number-pad" value={quantity === 0 ? "" : String(quantity)} onChangeText={(value) => {
            if (!/^\d*$/.test(value)) return;
            onChange({ ...item, quantity: value === "" ? 0 : Math.min(ITEM_QUANTITY_MAX, Number(value)) });
          }} style={styles.quantityInput} selectTextOnFocus />
          <Pressable accessibilityRole="button" accessibilityLabel={t("flow.itemDetail.increaseQuantity")} accessibilityState={{ disabled: quantity >= ITEM_QUANTITY_MAX }} disabled={quantity >= ITEM_QUANTITY_MAX} onPress={() => onChange({ ...item, quantity: Math.min(ITEM_QUANTITY_MAX, Math.max(1, quantity + 1)) })} style={styles.quantityButton}>
            <View style={[styles.plusButton, quantity >= ITEM_QUANTITY_MAX && styles.plusButtonDisabled]}>
            <Plus size={20} color={PALETTE.primary} />
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function ItemDiscountCard({ item, currency, locale, currencySymbol, onChange }: Props & { locale: string; currencySymbol: string }) {
  const { t } = useTranslation();
  const [discountFocused, setDiscountFocused] = useState(false);
  const discount = item.discount;
  if (!discount) {
    return (
      <View style={screenStyles.recentShadowWrap}>
        <View style={screenStyles.splitCardSurface}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("flow.itemDetail.addDiscount")} style={styles.addDiscount} onPress={() => onChange({ ...item, discount: { type: "percent", value: "" } })}>
            <Tag size={23} color={PALETTE.primary} />
            <Text style={[styles.cardTitle, styles.addDiscountText]}>{t("flow.itemDetail.addDiscount")}</Text>
            <Plus size={22} color={PALETTE.primary} />
          </Pressable>
        </View>
      </View>
    );
  }
  return (
    <View style={screenStyles.recentShadowWrap}>
      <View style={[screenStyles.splitCardSurface, styles.discountCard]}>
        <View style={styles.discountHeader}>
          <View style={styles.discountHeading}><Tag size={23} color={PALETTE.primary} /><Text style={styles.cardTitle}>{t("flow.itemDetail.discount")}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={t("flow.itemDetail.removeDiscount")} onPress={() => onChange({ ...item, discount: null })} style={styles.removeDiscount}><Trash2 size={20} color={PALETTE.primary} /></Pressable>
        </View>
        <View style={styles.discountRow}>
          <View style={styles.segmented}>
            {(["percent", "fixed"] as const).map((type) => (
              <Pressable key={type} accessibilityRole="button" accessibilityState={{ selected: discount.type === type }} accessibilityLabel={type === "percent" ? "%" : currency} onPress={() => onChange({ ...item, discount: { ...discount, type } })} style={[styles.segment, discount.type === type && styles.segmentSelected]}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.segmentText, discount.type === type && styles.segmentTextSelected]}>{type === "percent" ? "%" : currencySymbol}</Text>
              </Pressable>
            ))}
          </View>
          <View testID="discount-input-shell" style={[screenStyles.assignInputShell, styles.discountInputShell]}>
            <TextInput accessibilityLabel={t("flow.itemDetail.discount")} keyboardType="decimal-pad" value={discount.type === "fixed" && !discountFocused ? formatEditableAmount(discount.value, locale) : discount.value} placeholder={discountFocused ? "" : "0"} placeholderTextColor={PALETTE.inputPlaceholder} onFocus={() => setDiscountFocused(true)} onBlur={() => setDiscountFocused(false)} onChangeText={(value) => {
              setDiscountFocused(true);
              const nextValue = /^-\d*(?:[.,]\d*)?$/.test(value.trim()) ? "0" : limitDecimalPlaces(value);
              onChange({ ...item, discount: { ...discount, value: nextValue } });
            }} style={styles.discountInput} />
          </View>
        </View>
      </View>
    </View>
  );
}

export function ItemPricingSummary({ item, currency, currencySymbol, locale, onValueLimitPress }: { item: ItemFormValue; currency: string; currencySymbol: string; locale: string; onValueLimitPress: () => void }) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const total = getItemTotalCents(item);
  const unit = parseMoneyToCents(item.price);
  const subtotal = unit === null ? null : unit * (item.quantity ?? 1);
  const totalText = total === null ? "—" : formatMoney(total, currency, locale);
  const valueTooHigh = validateItemPricing(item).some((error) => error.code === "item-amount-too-high");
  const subtotalText = subtotal === null || !Number.isSafeInteger(subtotal) ? "—" : formatMoney(subtotal, currency, locale);
  return (
    <View style={styles.summary}>
      {item.discount ? (
        <>
          <View style={styles.summaryLine}>
            <NativeText allowFontScaling={false} style={[styles.summaryText, { fontSize: 14 * fontScale }]}>{t("flow.itemDetail.subtotal")}</NativeText>
            <NativeText allowFontScaling={false} style={[styles.summaryRightText, { fontSize: 14 * fontScale }]}>{subtotalText}</NativeText>
          </View>
          <View style={styles.summaryLine}>
            <NativeText allowFontScaling={false} style={[styles.summaryText, { fontSize: 14 * fontScale }]}>{t("flow.itemDetail.discount")} ({item.discount.type === "percent" ? `${item.discount.value.trim() || "0"}%` : currencySymbol})</NativeText>
            <NativeText allowFontScaling={false} style={[styles.discountValue, { fontSize: 14 * fontScale }]}>{total === null || subtotal === null ? "—" : `−${formatMoney(subtotal - total, currency, locale)}`}</NativeText>
          </View>
          <View style={styles.summaryDivider} />
        </>
      ) : null}
      <View testID="item-total-row" style={styles.summaryLine}>
        <NativeText allowFontScaling={false} style={[styles.expandedTotalLabel, { fontSize: 20 * fontScale }]}>{t("flow.itemDetail.itemTotal")}</NativeText>
        {valueTooHigh ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t("flow.itemDetail.valueLimitDetails")} onPress={onValueLimitPress} hitSlop={10}>
            <AlertTriangle color={PALETTE.danger} size={24} />
          </Pressable>
        ) : <NativeText allowFontScaling={false} style={[styles.expandedTotalValue, { fontSize: 24 * fontScale }]}>{totalText}</NativeText>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  priceRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  priceColumn: { flex: 1, minWidth: 0, gap: 8 },
  quantityColumn: { width: 132, gap: 8 },
  priceInputShell: { minHeight: 62, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" },
  priceInput: { flex: 1, minWidth: 0, minHeight: 54, fontFamily: FONTS.headlineBlack, color: PALETTE.onSurface, fontSize: 19, padding: 0, includeFontPadding: false, textAlignVertical: "center" },
  currency: { fontFamily: FONTS.bodyBold, color: PALETTE.onSurfaceVariant, fontSize: 13, marginLeft: 5, includeFontPadding: false, textAlignVertical: "center" },
  multiply: { fontFamily: FONTS.bodyBold, color: PALETTE.onSurface, fontSize: 22, marginBottom: 17 },
  quantityShell: { height: 62, borderRadius: 20, backgroundColor: PALETTE.surfaceContainerLow, flexDirection: "row", alignItems: "center" },
  quantityButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  minusButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: PALETTE.surfaceContainerHigh },
  plusButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: PALETTE.primaryContainer },
  plusButtonDisabled: { opacity: 0.4 },
  quantityInput: { flex: 1, minWidth: 0, textAlign: "center", textAlignVertical: "center", includeFontPadding: false, padding: 0, color: PALETTE.onSurface, fontFamily: FONTS.headlineBold, fontSize: 20 },
  addDiscount: { minHeight: 64, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 12 },
  addDiscountText: { flex: 1 },
  cardTitle: { color: PALETTE.onSurface, fontFamily: FONTS.headlineBold, fontSize: 17 },
  discountCard: { padding: 16, gap: 10 },
  discountHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  discountHeading: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  removeDiscount: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -12 },
  discountRow: { flexDirection: "row", gap: 10 },
  segmented: { flexDirection: "row", width: "36%", height: 62, borderRadius: 20, padding: 4, backgroundColor: PALETTE.surfaceContainerLow },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  segmentSelected: { backgroundColor: PALETTE.primary },
  segmentText: { color: PALETTE.onSurfaceVariant, fontFamily: FONTS.bodyBold, fontSize: 16 },
  segmentTextSelected: { color: PALETTE.onPrimary },
  discountInputShell: { flex: 1, minHeight: 62, flexDirection: "row", alignItems: "center" },
  discountInput: { flex: 1, minWidth: 0, minHeight: 54, color: PALETTE.onSurface, fontFamily: FONTS.headlineBold, fontSize: 21, padding: 0, includeFontPadding: false, textAlignVertical: "center" },
  summary: { gap: 7 },
  summaryLine: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 10, rowGap: 2 },
  summaryText: { color: PALETTE.onSurface, fontFamily: FONTS.body, fontSize: 14, maxWidth: "100%" },
  summaryRightText: { color: PALETTE.onSurface, fontFamily: FONTS.body, fontSize: 14, textAlign: "right", marginLeft: "auto", maxWidth: "100%" },
  discountValue: { color: PALETTE.primary, fontFamily: FONTS.bodyBold, fontSize: 14, textAlign: "right", marginLeft: "auto", maxWidth: "100%" },
  summaryDivider: { height: 1, backgroundColor: PALETTE.divider, marginVertical: 4 },
  expandedTotalLabel: { color: PALETTE.onSurface, fontFamily: FONTS.headlineBold, fontSize: 20, maxWidth: "100%" },
  expandedTotalValue: { color: PALETTE.onSurface, fontFamily: FONTS.headlineBlack, fontSize: 24, textAlign: "right", marginLeft: "auto", maxWidth: "100%" },
});
