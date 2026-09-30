/**
 * PracticeKeyboardHelpContent.ts
 *
 * Content for the keyboard-help dialog (the "?" button in the navigation bar).
 *
 * The instrument is locked — reading it is the point — and the answer is a
 * native text input. Basic Actions covers Tab, the game buttons, and Reset All.
 * There is no sim HotkeyData on this screen to build a fromHotkeyData row from.
 */

import { BasicActionsKeyboardHelpSection, TwoColumnKeyboardHelpContent } from "scenerystack/scenery-phet";

export class PracticeKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor() {
    super([new BasicActionsKeyboardHelpSection()], []);
  }
}
