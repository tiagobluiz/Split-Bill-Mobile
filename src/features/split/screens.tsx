import { HomeScreenView } from "./screens/home/HomeScreen";
import { AssignItemScreen, SplitItemScreen } from "./screens/flow/ItemDetailScreens";
import { ItemsScreenView } from "./screens/flow/ItemsScreen";
import { OverviewScreenView } from "./screens/flow/OverviewScreen";
import { ParticipantsScreenView } from "./screens/flow/ParticipantsScreen";
import { PasteImportScreenView } from "./screens/flow/PasteImportScreen";
import { PayerScreenView } from "./screens/flow/PayerScreen";
import { ResultsScreenView } from "./screens/flow/ResultsScreen";
import { ReviewScreenView } from "./screens/flow/ReviewScreen";
import { SetupScreenView } from "./screens/flow/SetupScreen";

export function HomeScreen() {
  return <HomeScreenView />;
}

export function SetupScreen({ draftId }: { draftId: string }) {
  return <SetupScreenView draftId={draftId} />;
}

export function ParticipantsScreen({ draftId }: { draftId: string }) {
  return <ParticipantsScreenView draftId={draftId} />;
}

export function PayerScreen({ draftId }: { draftId: string }) {
  return <PayerScreenView draftId={draftId} />;
}

export function ItemsScreen({ draftId }: { draftId: string }) {
  return <ItemsScreenView draftId={draftId} />;
}

export function PasteImportScreen({ draftId }: { draftId: string }) {
  return <PasteImportScreenView draftId={draftId} />;
}

export { AssignItemScreen, SplitItemScreen };

export function OverviewScreen({ draftId }: { draftId: string }) {
  return <OverviewScreenView draftId={draftId} />;
}

export function ReviewScreen({ draftId }: { draftId: string }) {
  return <ReviewScreenView draftId={draftId} />;
}

export function ResultsScreen({ draftId }: { draftId: string }) {
  return <ResultsScreenView draftId={draftId} />;
}
