import { EnabledDirections } from "./types";
import { directionLabels } from "../../i18n/study";

export const defaultDirections = Object.fromEntries(
  directionLabels.map(([key]) => [key, true]),
) as EnabledDirections;
