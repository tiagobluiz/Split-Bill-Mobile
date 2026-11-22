import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType } from "react-native";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "../../../../i18n/provider";
import { withAppDatabaseRetry, withDatabaseTransaction } from "../../../../storage/database";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useSplitStore } from "../../store";
import type { TranslationKey } from "../../../../i18n";
import app from "../../../../../app.json";

const CONTENT_GUTTER = 24;
const MAX_CONTENT_WIDTH = 480;
type Slide = {
  image: ImageSourcePropType;
  title: TranslationKey;
  paragraphs: readonly TranslationKey[];
  improved?: boolean;
};

// Retain earlier announcements so users who skip releases can catch up.
const announcements: readonly { version: string; slides: readonly Slide[] }[] = [
  {
    version: "2.14.0",
    slides: [
      {
        image: require("../../../../../assets/whats-new-people.jpg"),
        title: "whatsNew.people.title",
        paragraphs: ["whatsNew.people.directory", "whatsNew.people.profile"],
      },
      {
        image: require("../../../../../assets/whats-new-quantities.jpg"),
        title: "whatsNew.quantities.title",
        paragraphs: ["whatsNew.quantities.description"],
      },
      {
        image: require("../../../../../assets/whats-new-performance.jpg"),
        title: "whatsNew.performance.title",
        paragraphs: ["whatsNew.performance.description"],
        improved: true,
      },
    ],
  },
];

function compareVersions(left: string, right: string) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (leftParts[i] !== rightParts[i]) return leftParts[i] - rightParts[i];
  }
  return 0;
}

function readSeenVersion(payload: string | undefined) {
  if (!payload) return null;
  try {
    const seen: unknown = JSON.parse(payload);
    return typeof seen === "string" && /^\d+\.\d+\.\d+$/.test(seen) ? seen : null;
  } catch {
    return null;
  }
}

export function getUnseenAnnouncements<T extends { version: string; slides: readonly unknown[] }>(
  releases: readonly T[], installedVersion: string, seenVersion: string | null,
) {
  return releases.filter(({ version, slides }) => slides.length > 0 &&
    compareVersions(version, installedVersion) <= 0 &&
    (seenVersion === null || compareVersions(version, seenVersion) > 0),
  ).sort((left, right) => compareVersions(left.version, right.version));
}

const WhatsNewContext = createContext<{ open: () => void } | null>(null);

export function useWhatsNew() {
  return useContext(WhatsNewContext);
}

export function WhatsNewProvider({ children }: PropsWithChildren) {
  const setupCompleted = useSplitStore((state) => state.profileSetupCompleted);
  const [entry, setEntry] = useState<"launch" | "settings" | null>(null);
  const launchConsidered = useRef(false);
  const [seenVersion, setSeenVersion] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (setupCompleted && !launchConsidered.current) {
      launchConsidered.current = true;
      setEntry("launch");
    }
  }, [setupCompleted]);

  useEffect(() => {
    if (!announcements.length) return;
    let active = true;
    void withAppDatabaseRetry((db) => db.getFirstAsync<{ payload: string }>("SELECT payload FROM release_announcements WHERE key = ?", ["whats-new-seen"]))
      .then((row) => { if (active) setSeenVersion(readSeenVersion(row?.payload)); })
      .catch((err) => console.warn("Could not load release announcement", err));
    return () => { active = false; };
  }, []);

  const unseen = seenVersion === undefined ? [] : getUnseenAnnouncements(announcements, app.expo.version, seenVersion);
  const latest = unseen.at(-1);
  const close = () => setEntry(null);
  const acknowledge = async (version: string) => {
    await withDatabaseTransaction(async (db) => {
      await db.runAsync("INSERT INTO release_announcements (key, payload) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload", ["whats-new-seen", JSON.stringify(version)]);
    });
    setSeenVersion(version);
  };

  return (
    <WhatsNewContext.Provider value={setupCompleted && latest ? { open: () => setEntry("settings") } : null}>
      {children}
      {entry && latest ? (
        <WhatsNewModal
          slides={unseen.flatMap((release) => release.slides)}
          onAcknowledge={() => acknowledge(latest.version)}
          onClose={close}
          onSeeLater={entry === "launch" ? close : undefined}
        />
      ) : null}
    </WhatsNewContext.Provider>
  );
}

function WhatsNewModal({ slides, onAcknowledge, onClose, onSeeLater }: {
  slides: readonly Slide[];
  onAcknowledge: () => Promise<void>;
  onClose: () => void;
  onSeeLater?: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(MAX_CONTENT_WIDTH, Math.max(0, width - 2 * CONTENT_GUTTER));
  const [index, setIndex] = useState(0);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const complete = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await onAcknowledge();
      onClose();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const slide = slides[index];
  const button = { minHeight: 52, justifyContent: "center" as const, alignItems: "center" as const, paddingHorizontal: 20 };
  return <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={() => { if (!onSeeLater && !busy) onClose(); }}>
    <View style={{ flex: 1, backgroundColor: PALETTE.surface, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingTop: 16 }}>
        <Image source={require("../../../../../assets/icon.png")} style={{ width: 42, height: 42, borderRadius: 10 }} />
        <Text style={{ flex: 1, marginLeft: 12, fontFamily: FONTS.bodyBold, fontSize: 18, color: PALETTE.onSurface }}>{t("app.name")}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t("whatsNew.close")} hitSlop={12} onPress={onSeeLater ? () => void complete() : onClose} disabled={busy}><X color={PALETTE.onSurface} size={26} /></Pressable>
      </View>
      <ScrollView key={index} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: CONTENT_GUTTER, paddingTop: 22 }}>
        <View style={{ alignSelf: "center", width: contentWidth }}>
          <Text style={{ fontFamily: FONTS.headlineBlack, fontSize: 34, color: PALETTE.onSurface }}>{t("settings.whatsNew")}</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 16, color: PALETTE.onSurfaceVariant, marginTop: 8 }}>{t("whatsNew.subtitle")}</Text>
          <View style={[styles.illustration, { height: contentWidth * 9 / 16 }]}>
            <Image source={slide.image} accessibilityIgnoresInvertColors resizeMode="contain" style={styles.illustrationImage} />
          </View>
          <View style={styles.slideCopy}>
            <Text style={{ fontFamily: FONTS.headlineBold, fontSize: 24, color: PALETTE.onSurface }}>{t(slide.title)}</Text>
            {slide.paragraphs.map((key) => <Text key={key} style={styles.paragraph}>{t(key)}</Text>)}
            <Text style={{ alignSelf: "flex-start", overflow: "hidden", backgroundColor: slide.improved ? PALETTE.successContainer : PALETTE.secondaryContainer, color: slide.improved ? PALETTE.onSuccessContainer : PALETTE.primary, fontFamily: FONTS.bodyBold, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5, marginTop: 16 }}>{t(slide.improved ? "whatsNew.improved" : "whatsNew.new")}</Text>
          </View>
        </View>
        <View style={{ flex: 1, minHeight: 30 }} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 22 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("whatsNew.previous")} disabled={index === 0} onPress={() => setIndex(index - 1)} style={{ opacity: index === 0 ? 0.3 : 1 }}><ChevronLeft color={PALETTE.primary} size={32} /></Pressable>
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: FONTS.body, color: PALETTE.onSurface }}>{t("whatsNew.position", { current: index + 1, total: slides.length })}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t("whatsNew.next")} disabled={index === slides.length - 1} onPress={() => setIndex(index + 1)} style={{ opacity: index === slides.length - 1 ? 0.3 : 1 }}><ChevronRight color={PALETTE.primary} size={32} /></Pressable>
        </View>
        {error ? <Text accessibilityRole="alert" style={{ color: PALETTE.danger }}>{t("whatsNew.saveError")}</Text> : null}
      </ScrollView>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, borderTopWidth: 1, borderColor: PALETTE.divider, paddingTop: 12 }}>
        {onSeeLater ? <Pressable accessibilityRole="button" onPress={onSeeLater} disabled={busy} style={button}><Text style={{ fontFamily: FONTS.bodyBold, color: PALETTE.primary }}>{t("whatsNew.seeLater")}</Text></Pressable> : <View />}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => index === slides.length - 1 ? void complete() : setIndex(index + 1)} style={{ ...button, borderRadius: 20, backgroundColor: PALETTE.primary }}><Text style={{ fontFamily: FONTS.bodyBold, color: PALETTE.onPrimary }}>{t(index === slides.length - 1 ? "whatsNew.done" : "whatsNew.next")}</Text></Pressable>
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
