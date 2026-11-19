import { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "../../../../i18n/provider";
import { withAppDatabaseRetry, withDatabaseTransaction } from "../../../../storage/database";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useSplitStore } from "../../store";

// Update this release and its slides only when there is an announcement to show.
const RELEASE = "2.14.0";
const CONTENT_GUTTER = 24;
const MAX_CONTENT_WIDTH = 480;
const slides = [
  {
    image: require("../../../../../assets/whats-new-people.jpg"),
    en: ["People & Groups", "Manage saved people, groups, and your profile in the new People menu.", "You’ll now need to set a name so others can recognise you in splits."],
    pt: ["Pessoas e grupos", "No novo menu Pessoas, podes gerir as pessoas guardadas, os grupos e o teu perfil.", "Agora tens de definir um nome para que te possam reconhecer nas divisões."],
  },
  {
    image: require("../../../../../assets/whats-new-quantities.jpg"),
    en: ["Quantities & Discounts", "When you add or edit an item manually, you can set its quantity and apply a fixed-amount or percentage discount."],
    pt: ["Quantidades e descontos", "Ao adicionares ou editares um item manualmente, podes definir a quantidade e aplicar um desconto de valor fixo ou em percentagem."],
  },
  {
    image: require("../../../../../assets/whats-new-performance.jpg"),
    en: ["Performance Improvements", "Split Bill runs more smoothly when you’re managing several splits with lots of people and items."],
    pt: ["Melhorias de desempenho", "A Split Bill funciona de forma mais fluida quando geres várias divisões com muitas pessoas e itens."],
  },
];

export const hasWhatsNewSlides = slides.length > 0;

function hasSeenRelease(payload: string | undefined) {
  if (!payload) return false;
  try {
    const seen: unknown = JSON.parse(payload);
    if (typeof seen !== "string" || !/^\d+\.\d+\.\d+$/.test(seen)) return false;
    const current = RELEASE.split(".").map(Number);
    const saved = seen.split(".").map(Number);
    for (let i = 0; i < current.length; i += 1) {
      if (saved[i] !== current[i]) return saved[i] > current[i];
    }
    return true;
  } catch {
    return false;
  }
}

export function WhatsNewGate() {
  const setupCompleted = useSplitStore((state) => state.profileSetupCompleted);
  const [eligibleAtLaunch] = useState(setupCompleted);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!eligibleAtLaunch || !hasWhatsNewSlides) return;
    let active = true;
    void withAppDatabaseRetry((db) => db.getFirstAsync<{ payload: string }>("SELECT payload FROM release_announcements WHERE key = ?", ["whats-new-seen"]))
      .then((row) => { if (active && !hasSeenRelease(row?.payload)) setVisible(true); })
      .catch((err) => console.warn("Could not load release announcement", err));
    return () => { active = false; };
  }, [eligibleAtLaunch]);

  const complete = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await withDatabaseTransaction(async (db) => {
        await db.runAsync("INSERT INTO release_announcements (key, payload) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload", ["whats-new-seen", JSON.stringify(RELEASE)]);
      });
      setVisible(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return visible ? <WhatsNewModal onClose={() => void complete()} onSeeLater={() => setVisible(false)} busy={busy} error={error} /> : null;
}

export function WhatsNewModal({ onClose, onSeeLater, busy = false, error = false }: {
  onClose: () => void;
  onSeeLater?: () => void;
  busy?: boolean;
  error?: boolean;
}) {
  const { language, t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(MAX_CONTENT_WIDTH, Math.max(0, width - 2 * CONTENT_GUTTER));
  const [index, setIndex] = useState(0);
  const pt = language === "pt";
  const slide = slides[index];
  const [title, ...paragraphs] = pt ? slide.pt : slide.en;
  const button = { minHeight: 52, justifyContent: "center" as const, alignItems: "center" as const, paddingHorizontal: 20 };
  return <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={() => { if (!onSeeLater) onClose(); }}>
    <View style={{ flex: 1, backgroundColor: PALETTE.surface, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingTop: 16 }}>
        <Image source={require("../../../../../assets/icon.png")} style={{ width: 42, height: 42, borderRadius: 10 }} />
        <Text style={{ flex: 1, marginLeft: 12, fontFamily: FONTS.bodyBold, fontSize: 18, color: PALETTE.onSurface }}>Split Bill</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={pt ? "Fechar novidades" : "Close What’s New"} hitSlop={12} onPress={onClose} disabled={busy}><X color={PALETTE.onSurface} size={26} /></Pressable>
      </View>
      <ScrollView key={index} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: CONTENT_GUTTER, paddingTop: 22 }}>
        <View style={{ alignSelf: "center", width: contentWidth }}>
          <Text style={{ fontFamily: FONTS.headlineBlack, fontSize: 34, color: PALETTE.onSurface }}>{t("settings.whatsNew")}</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 16, color: PALETTE.onSurfaceVariant, marginTop: 8 }}>{pt ? "Descobre as novidades desta atualização." : "Discover what’s new in this update."}</Text>
          <View style={[styles.illustration, { height: contentWidth * 9 / 16 }]}>
            <Image source={slide.image} accessibilityIgnoresInvertColors resizeMode="contain" style={styles.illustrationImage} />
          </View>
          <View style={styles.slideCopy}>
            <Text style={{ fontFamily: FONTS.headlineBold, fontSize: 24, color: PALETTE.onSurface }}>{title}</Text>
            {paragraphs.map((paragraph) => <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>)}
            <Text style={{ alignSelf: "flex-start", overflow: "hidden", backgroundColor: index === 2 ? PALETTE.successContainer : PALETTE.secondaryContainer, color: index === 2 ? PALETTE.onSuccessContainer : PALETTE.primary, fontFamily: FONTS.bodyBold, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5, marginTop: 16 }}>{index === 2 ? (pt ? "Melhorado" : "Improved") : (pt ? "Novo" : "New")}</Text>
          </View>
        </View>
        <View style={{ flex: 1, minHeight: 30 }} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 22 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={pt ? "Anterior" : "Previous"} disabled={index === 0} onPress={() => setIndex(index - 1)} style={{ opacity: index === 0 ? 0.3 : 1 }}><ChevronLeft color={PALETTE.primary} size={32} /></Pressable>
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: FONTS.body, color: PALETTE.onSurface }}>{index + 1} {pt ? "de" : "of"} {slides.length}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={pt ? "Seguinte" : "Next"} disabled={index === slides.length - 1} onPress={() => setIndex(index + 1)} style={{ opacity: index === slides.length - 1 ? 0.3 : 1 }}><ChevronRight color={PALETTE.primary} size={32} /></Pressable>
        </View>
        {error ? <Text accessibilityRole="alert" style={{ color: PALETTE.danger }}>{pt ? "Não foi possível guardar. Tenta novamente." : "Could not save. Please try again."}</Text> : null}
      </ScrollView>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, borderTopWidth: 1, borderColor: PALETTE.divider, paddingTop: 12 }}>
        {onSeeLater ? <Pressable accessibilityRole="button" onPress={onSeeLater} disabled={busy} style={button}><Text style={{ fontFamily: FONTS.bodyBold, color: PALETTE.primary }}>{pt ? "Ver mais tarde" : "See Later"}</Text></Pressable> : <View />}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => index === slides.length - 1 ? onClose() : setIndex(index + 1)} style={{ ...button, borderRadius: 20, backgroundColor: PALETTE.primary }}><Text style={{ fontFamily: FONTS.bodyBold, color: PALETTE.onPrimary }}>{index === slides.length - 1 ? (pt ? "Concluir" : "Done") : (pt ? "Seguinte" : "Next")}</Text></Pressable>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  illustration: {
    marginTop: 22,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: PALETTE.secondaryContainer,
  },
  illustrationImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  slideCopy: {
    paddingHorizontal: 10,
    marginTop: 18,
  },
  paragraph: {
    fontFamily: FONTS.body,
    fontSize: 16,
    lineHeight: 23,
    color: PALETTE.onSurfaceVariant,
    marginTop: 8,
  },
});
