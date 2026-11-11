import { dateLocale, t } from "@/lib/i18n";
import { timeParts } from "./time-format";
import {
  Document,
  Page,
  Text,
  View,
  Font,
  pdf,
  StyleSheet,
} from "@react-pdf/renderer";
import type { DocumentVersion } from "./domain";

Font.registerHyphenationCallback((word) => [word]);
const styles = StyleSheet.create({
  page: {
    fontFamily: "PretendardPDF",
    fontSize: 10,
    paddingTop: 44,
    paddingBottom: 48,
    paddingHorizontal: 46,
    lineHeight: 1.7,
    color: "#20232a",
  },
  title: { fontSize: 22, marginBottom: 8 },
  meta: { fontSize: 8, color: "#737880", marginBottom: 24 },
  paragraph: { marginBottom: 9 },
  heading: { fontSize: 15, marginTop: 15, marginBottom: 8 },
  table: { borderWidth: 0.5, borderColor: "#bbc0c7", marginBottom: 12 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#bbc0c7" },
  cell: { flex: 1, padding: 6, borderRightWidth: 0.5, borderColor: "#bbc0c7" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 46,
    right: 46,
    fontSize: 8,
    color: "#737880",
    textAlign: "right",
  },
});
type N = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string }[];
  content?: N[];
};
function inline(n: N): string {
  if (n.type === "hardBreak") return "\n";
  return n.text ?? n.content?.map(inline).join("") ?? "";
}
function block(n: N, i: number): React.ReactNode {
  if (n.type === "table")
    return (
      <View key={i} style={styles.table}>
        {n.content?.map((row, j) => (
          <View key={j} style={styles.row} wrap={false}>
            {row.content?.map((cell, k) => (
              <View key={k} style={styles.cell}>
                <Text>{inline(cell)}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  if (n.type === "bulletList" || n.type === "orderedList")
    return (
      <View key={i}>
        {n.content?.map((item, j) => (
          <Text key={j} style={styles.paragraph}>
            {n.type === "orderedList" ? `${j + 1}. ` : "• "}
            {inline(item)}
          </Text>
        ))}
      </View>
    );
  if (n.type === "horizontalRule")
    return (
      <View
        key={i}
        style={{
          borderBottomWidth: 1,
          borderColor: "#ccd0d6",
          marginVertical: 12,
        }}
      />
    );
  return (
    <Text
      key={i}
      style={n.type === "heading" ? styles.heading : styles.paragraph}
    >
      {inline(n) || " "}
    </Text>
  );
}
export async function documentPDF(
  version: DocumentVersion,
  fontSource = "/fonts/Pretendard-Regular.woff",
): Promise<Blob> {
  Font.register({ family: "PretendardPDF", src: fontSource });
  const content = version.content as N;
  return pdf(
    <Document title={version.title} author={t("마진")}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{version.title}</Text>
        <Text style={styles.meta}>
          v{version.number} ·{" "}
          {new Date(version.createdAt).toLocaleString(dateLocale(), {
            year: "numeric",
            month: "long",
            day: "numeric",
            ...timeParts(),
          })}
        </Text>
        {content.content?.map(block)}
        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
        />
      </Page>
    </Document>,
  ).toBlob();
}
