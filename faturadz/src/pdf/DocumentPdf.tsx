import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PdfModel } from "./model";

let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  Font.register({
    family: "Noto Sans",
    fonts: [
      { src: "/fonts/noto-sans-latin-400-normal.woff", fontWeight: 400 },
      { src: "/fonts/noto-sans-latin-700-normal.woff", fontWeight: 700 },
    ],
  });
  // No automatic hyphenation (its patterns are English).
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const ink = "#16181d";
const muted = "#5d6470";
const line = "#c9ced6";
const accent = "#0f6b4f";

const s = StyleSheet.create({
  page: { fontFamily: "Noto Sans", fontSize: 9, color: ink, padding: 36, paddingBottom: 56 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  sellerBlock: { flexDirection: "row", gap: 10, maxWidth: "60%" },
  logo: { width: 64, height: 64, objectFit: "contain" },
  sellerName: { fontSize: 13, fontWeight: 700, marginBottom: 2 },
  mutedText: { color: muted },
  titleBlock: { alignItems: "flex-end" },
  title: { fontSize: 18, fontWeight: 700, color: accent },
  draftBadge: { fontSize: 10, fontWeight: 700, color: "#b42318", marginTop: 2 },
  boxes: { flexDirection: "row", gap: 10, marginBottom: 14 },
  box: { flex: 1, borderWidth: 1, borderColor: line, borderRadius: 3, padding: 8 },
  boxLabel: { fontSize: 7, color: muted, textTransform: "uppercase", marginBottom: 3 },
  bold: { fontWeight: 700 },
  idRow: { flexDirection: "row" },
  idKey: { width: 48, color: muted },
  table: { borderWidth: 1, borderColor: line, borderRadius: 3 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: line },
  th: { backgroundColor: "#eef1f4", fontWeight: 700 },
  cell: { padding: 4 },
  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 10 },
  totals: { width: "55%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  netRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: ink, paddingTop: 4, marginTop: 2, fontSize: 11, fontWeight: 700 },
  words: { marginTop: 14 },
  bottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 18, gap: 16 },
  signature: { width: 180, height: 70, borderWidth: 1, borderColor: line, borderRadius: 3, padding: 6 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 7, color: muted, textAlign: "center" },
});

// Column widths: designation, unit, qty, unit price, discount, TVA, total.
const COLS = [
  { width: "34%", align: "left" },
  { width: "8%", align: "left" },
  { width: "9%", align: "right" },
  { width: "15%", align: "right" },
  { width: "9%", align: "right" },
  { width: "8%", align: "right" },
  { width: "17%", align: "right" },
] as const;

function Ids({ ids }: { ids: [string, string][] }) {
  return (
    <>
      {ids.map(([k, v]) => (
        <View key={k} style={s.idRow}>
          <Text style={s.idKey}>{k}</Text>
          <Text>{v}</Text>
        </View>
      ))}
    </>
  );
}

export function DocumentPdf({ model }: { model: PdfModel }) {
  registerFonts();
  return (
    <Document title={model.number ?? model.title} author={model.seller.name} creator="FaturaDZ" producer="FaturaDZ">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.sellerBlock}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            {model.logo && <Image src={model.logo} style={s.logo} />}
            <View>
              <Text style={s.sellerName}>{model.seller.name}</Text>
              {model.seller.lines.map((l, i) => (
                <Text key={i} style={s.mutedText}>
                  {l}
                </Text>
              ))}
            </View>
          </View>
          <View style={s.titleBlock}>
            <Text style={s.title}>{model.title}</Text>
            {model.number && <Text style={s.bold}>N° {model.number}</Text>}
            {model.isDraft && <Text style={s.draftBadge}>BROUILLON — SANS VALEUR</Text>}
            <Text>Date : {model.issueDate}</Text>
            {model.dueDate && <Text>Échéance : {model.dueDate}</Text>}
          </View>
        </View>

        <View style={s.boxes}>
          <View style={s.box}>
            <Text style={s.boxLabel}>Vendeur</Text>
            <Ids ids={model.seller.ids} />
          </View>
          {model.client && (
            <View style={s.box}>
              <Text style={s.boxLabel}>{model.client.label}</Text>
              <Text style={s.bold}>{model.client.name}</Text>
              {model.client.lines.map((l, i) => (
                <Text key={i}>{l}</Text>
              ))}
              <Ids ids={model.client.ids} />
            </View>
          )}
        </View>

        <View style={s.table}>
          <View style={[s.tr, s.th]} fixed>
            {model.columns.map((c, i) => (
              <Text key={c} style={[s.cell, { width: COLS[i].width, textAlign: COLS[i].align }]}>
                {c}
              </Text>
            ))}
          </View>
          {model.rows.map((row, r) => (
            <View key={r} style={s.tr} wrap={false}>
              {row.map((v, i) => (
                <Text key={i} style={[s.cell, { width: COLS[i].width, textAlign: COLS[i].align }]}>
                  {v}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={s.totalsWrap} wrap={false}>
          <View style={s.totals}>
            {model.totals.map(([k, v]) => (
              <View key={k} style={s.totalRow}>
                <Text>{k}</Text>
                <Text>{v}</Text>
              </View>
            ))}
            <View style={s.netRow}>
              <Text>{model.net[0]}</Text>
              <Text>{model.net[1]}</Text>
            </View>
          </View>
        </View>

        <View style={s.words} wrap={false}>
          <Text>{model.inWordsLabel}</Text>
          <Text style={s.bold}>{model.inWords}</Text>
        </View>

        <View style={s.bottom} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text>{model.payment}</Text>
            {model.tvaNotice && <Text style={s.mutedText}>{model.tvaNotice}</Text>}
            {model.notes !== "" && <Text style={{ marginTop: 6 }}>{model.notes}</Text>}
          </View>
          <View style={s.signature}>
            <Text style={s.boxLabel}>Cachet et signature</Text>
          </View>
        </View>

        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `${model.footer ? `${model.footer} — ` : ""}Page ${pageNumber}/${totalPages}`} />
      </Page>
    </Document>
  );
}
