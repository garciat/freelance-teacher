import {
  Document,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

export interface InvoiceSender {
  name: string;
  address: string;
  location: string;
  /** Mandatory 8-digit Dutch Chamber of Commerce number (Kamer van Koophandel) */
  kvk: string;
  /** Dutch BTW/VAT identification number (e.g., NL812345678B01) */
  vat: string;
  iban: string;
  bic: string;
}

export interface InvoiceClient {
  name: string;
  address: string;
  zipCity: string;
  /** Optional for B2C, highly recommended/mandatory for B2B compliance */
  vatNumber?: string;
}

export interface InvoiceMeta {
  /** Must follow a continuous, sequential numbering system */
  number: string;
  /** Format: DD-MM-YYYY or YYYY-MM-DD */
  date: Temporal.PlainDate;
  /** Format: DD-MM-YYYY or YYYY-MM-DD */
  dueDate: Temporal.PlainDate;
  /** Payment term window in days (e.g., 14 or 30) */
  paymentTerms: number;
}

export interface InvoiceItem {
  description: string;
  qty: number;
  /** Price per individual unit excluding VAT */
  price: number;
  /** VAT % for this item type */
  vatPct: number;
  total: number;
}

export interface InvoiceTotal {
  beforeTax: number;
  taxAmount: number;
  total: number;
}

/**
 * Root wrapper interface representing the structured data
 * required by the DutchInvoice component.
 */
export interface DutchInvoiceData {
  title: string;
  sender: InvoiceSender;
  client: InvoiceClient;
  invoiceMeta: InvoiceMeta;
  items: InvoiceItem[];
  total: InvoiceTotal;
}

// Define clean, compliant styling using Flexbox
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#333333",
    lineHeight: 1.5,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    paddingBottom: 20,
    marginBottom: 30,
  },
  companyName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1A365D",
    paddingBottom: 20,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "right",
    color: "#1A365D",
    paddingBottom: 20,
  },
  metaContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  metaBlock: {
    flexDirection: "column",
    width: "45%",
  },
  blockTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 5,
    textTransform: "uppercase",
    color: "#718096",
  },
  table: {
    width: "auto",
    marginBottom: 30,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#EDF2F7",
    paddingVertical: 8,
    alignItems: "center",
  },
  tableHeader: {
    backgroundColor: "#1A365D",
    borderBottomWidth: 0,
  },
  tableHeaderCell: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  colDescription: { width: "50%", textAlign: "left" },
  colQty: { width: "10%", textAlign: "center" },
  colPrice: { width: "15%", textAlign: "right" },
  colVat: { width: "10%", textAlign: "right" },
  colTotal: { width: "15%", textAlign: "right" },
  totalsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 40,
  },
  totalsTable: {
    width: "40%",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: "#1A365D",
    marginTop: 5,
    paddingVertical: 6,
  },
  grandTotalText: {
    fontWeight: "bold",
    fontSize: 12,
    color: "#1A365D",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    paddingTop: 10,
    textAlign: "center",
    color: "#A0AEC0",
    fontSize: 8,
  },
});

interface DutchInvoiceProps {
  data: DutchInvoiceData;
}

export async function renderInvoiceToBuffer(
  data: DutchInvoiceData,
): Promise<ArrayBuffer> {
  const buffer = await renderToBuffer(<DutchInvoice data={data} />);
  return new Uint8Array(buffer.buffer).slice().buffer;
}

export async function renderInvoiceToBlob(
  data: DutchInvoiceData,
): Promise<Blob> {
  const buffer = await renderToBuffer(<DutchInvoice data={data} />);
  return new Blob([new Uint8Array(buffer)], { type: "application/pdf" });
}

export const DutchInvoice: React.FC<DutchInvoiceProps> = ({ data }) => {
  const { title, sender, client, invoiceMeta, items } = data;

  return (
    <Document title={title}>
      <Page size="A4" style={styles.page}>
        {/* 1. Header Section */}
        <View style={styles.headerContainer}>
          <View>
            <Text style={styles.companyName}>{sender.name}</Text>
            <Text>{sender.address}</Text>
            <Text>{sender.location}</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>FACTUUR</Text>
            <Text>Factuurnummer: {invoiceMeta.number}</Text>
            <Text>
              Datum:{" "}
              {invoiceMeta.date.toLocaleString("nl", { dateStyle: "short" })}
            </Text>
            <Text>
              Vervaldatum:{" "}
              {invoiceMeta.dueDate.toLocaleString("nl", { dateStyle: "short" })}
            </Text>
          </View>
        </View>

        {/* 2. Client & Compliance Addresses */}
        <View style={styles.metaContainer}>
          <View style={styles.metaBlock}>
            <Text style={styles.blockTitle}>Factureren aan:</Text>
            <Text style={{ fontWeight: "bold" }}>{client.name}</Text>
            <Text>{client.address}</Text>
            <Text>{client.zipCity}</Text>
            {client.vatNumber && <Text>BTW-id: {client.vatNumber}</Text>}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.blockTitle}>Bedrijfsgegevens:</Text>
            <Text>KvK-nummer: {sender.kvk}</Text>
            <Text>BTW-id: {sender.vat}</Text>
            <Text>IBAN: {sender.iban}</Text>
            <Text>BIC: {sender.bic}</Text>
          </View>
        </View>

        {/* 3. Items Table */}
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.colDescription, styles.tableHeaderCell]}>
              Omschrijving
            </Text>
            <Text style={[styles.colQty, styles.tableHeaderCell]}>Aantal</Text>
            <Text style={[styles.colPrice, styles.tableHeaderCell]}>Prijs</Text>
            <Text style={[styles.colPrice, styles.tableHeaderCell]}>BTW</Text>
            <Text style={[styles.colTotal, styles.tableHeaderCell]}>
              Totaal
            </Text>
          </View>

          {items.map((item, index) => (
            <View style={styles.tableRow} key={index}>
              <Text style={styles.colDescription}>{item.description}</Text>
              <Text style={styles.colQty}>{item.qty}</Text>
              <Text style={styles.colPrice}>€ {item.price.toFixed(2)}</Text>
              <Text style={styles.colPrice}>{item.vatPct} %</Text>
              <Text style={styles.colTotal}>€ {item.total.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* 4. Totals Breakdown */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsTable}>
            <View style={styles.totalsRow}>
              <Text>Subtotaal (Excl. BTW):</Text>
              <Text>€ {data.total.beforeTax.toFixed(2)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text>BTW:</Text>
              <Text>€ {data.total.taxAmount.toFixed(2)}</Text>
            </View>
            <View style={[styles.totalsRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalText}>Totaal (Incl. BTW):</Text>
              <Text style={styles.grandTotalText}>
                € {data.total.total.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* 5. Legal Footer */}
        <View style={styles.footer}>
          <Text>
            Wij verzoeken u vriendelijk het openstaande bedrag binnen{" "}
            {invoiceMeta.paymentTerms}{" "}
            dagen te voldoen onder vermelding van het factuurnummer.
          </Text>
          <Text>
            {sender.name} • KvK: {sender.kvk} • BTW: {sender.vat} • IBAN:{" "}
            {sender.iban}
          </Text>
        </View>
      </Page>
    </Document>
  );
};
