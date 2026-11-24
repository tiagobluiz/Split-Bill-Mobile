import type { ImageSourcePropType } from "react-native";
import type { TranslationKey } from "../../../../i18n";

export type WhatsNewSlide = {
  image: ImageSourcePropType;
  title: TranslationKey;
  paragraphs: readonly TranslationKey[];
  improved?: boolean;
};

// Retain earlier announcements so users who skip releases can catch up.
export const announcements: readonly { version: string; slides: readonly WhatsNewSlide[] }[] = [
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
  {
    version: "2.15.2",
    slides: [
      {
        image: require("../../../../../assets/whats-new-invoice-photos.jpg"),
        title: "whatsNew.invoicePhotos.title",
        paragraphs: ["whatsNew.invoicePhotos.attach", "whatsNew.invoicePhotos.handover"],
      },
    ],
  },
];
