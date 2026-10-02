/**
 * presetName.ts
 *
 * Display names for the presets. Real planet designations ("5. HD 68988 b")
 * are proper nouns and stay as written; the generic "N. Option X" entries are
 * built from a localized pattern so "Option" is translated.
 */

import { PatternStringProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { StringManager } from "../../i18n/StringManager.js";

const OPTION_NAME = /^(\d+)\. Option ([A-Z])$/;

export function createPresetNameProperty(name: string): TReadOnlyProperty<string> | string {
  const match = OPTION_NAME.exec(name);
  if (!match) {
    return name;
  }
  return new PatternStringProperty(StringManager.getInstance().getPresetStrings().optionPatternStringProperty, {
    number: match[1] ?? "",
    letter: match[2] ?? "",
  });
}
