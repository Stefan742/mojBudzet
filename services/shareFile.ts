import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/**
 * Writes `content` to a file in the app's cache and opens the system share
 * sheet for it (save to Files or Drive, mail it, open it in a spreadsheet).
 * The web build, used for testing, downloads the file instead.
 */
export async function shareTextFile(
  content: string,
  fileName: string,
  options: { mimeType: string; uti: string; dialogTitle: string }
): Promise<void> {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([content], { type: options.mimeType }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  // The same name is reused each day; an older copy is replaced.
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this device");
  await Sharing.shareAsync(file.uri, { mimeType: options.mimeType, UTI: options.uti, dialogTitle: options.dialogTitle });
}
