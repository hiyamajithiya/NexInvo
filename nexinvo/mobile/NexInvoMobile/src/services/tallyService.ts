import { api } from './api';
import { Invoice, Client } from '../types';

export interface TallyExportOptions {
  company: string;
  exportFormat: 'xml' | 'csv' | 'json';
  includeClients: boolean;
  includeInvoices: boolean;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  groupByCategory?: boolean;
}

export interface TallyExportResult {
  success: boolean;
  exportId: string;
  downloadUrl?: string;
  error?: string;
  recordCount: number;
  fileSize?: number;
}

export interface TallyConnectionConfig {
  serverUrl: string;
  port: number;
  companyName: string;
  username?: string;
  password?: string;
  licenseId?: string;
}

export interface TallyConnectionStatus {
  isConnected: boolean;
  lastConnected?: Date;
  version?: string;
  companyList?: string[];
  error?: string;
}

class TallyService {
  async testConnection(config: TallyConnectionConfig): Promise<TallyConnectionStatus> {
    try {
      const response = await api.post('/integrations/tally/test-connection', config);
      return {
        isConnected: response.data.success,
        lastConnected: new Date(),
        version: response.data.version,
        companyList: response.data.companies,
      };
    } catch (error: any) {
      console.error('Tally connection test failed:', error);
      return {
        isConnected: false,
        error: error.response?.data?.message || 'Connection failed',
      };
    }
  }

  async saveConfiguration(config: TallyConnectionConfig): Promise<boolean> {
    try {
      await api.post('/integrations/tally/configure', config);
      return true;
    } catch (error) {
      console.error('Failed to save Tally configuration:', error);
      return false;
    }
  }

  async getConfiguration(): Promise<TallyConnectionConfig | null> {
    try {
      const response = await api.get('/integrations/tally/configuration');
      return response.data;
    } catch (error) {
      console.error('Failed to get Tally configuration:', error);
      return null;
    }
  }

  async exportToTally(
    invoiceIds: string[],
    options: TallyExportOptions
  ): Promise<TallyExportResult> {
    try {
      const response = await api.post('/integrations/tally/export', {
        invoiceIds,
        options,
      });

      return {
        success: true,
        exportId: response.data.exportId,
        downloadUrl: response.data.downloadUrl,
        recordCount: response.data.recordCount,
        fileSize: response.data.fileSize,
      };
    } catch (error: any) {
      console.error('Tally export failed:', error);
      return {
        success: false,
        exportId: '',
        error: error.response?.data?.message || 'Export failed',
        recordCount: 0,
      };
    }
  }

  async getExportHistory(): Promise<Array<{
    id: string;
    createdAt: Date;
    invoiceCount: number;
    status: 'pending' | 'completed' | 'failed';
    downloadUrl?: string;
    error?: string;
  }>> {
    try {
      const response = await api.get('/integrations/tally/exports');
      return response.data.map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt),
      }));
    } catch (error) {
      console.error('Failed to get export history:', error);
      return [];
    }
  }

  async downloadExport(exportId: string): Promise<string | null> {
    try {
      const response = await api.get(`/integrations/tally/exports/${exportId}/download`, {
        responseType: 'blob',
      });

      // In React Native, you would handle file download differently
      // This is a simplified version
      return URL.createObjectURL(response.data);
    } catch (error) {
      console.error('Failed to download export:', error);
      return null;
    }
  }

  async syncMasterData(): Promise<{
    success: boolean;
    syncedAccounts: number;
    syncedGroups: number;
    error?: string;
  }> {
    try {
      const response = await api.post('/integrations/tally/sync-master');
      return {
        success: true,
        syncedAccounts: response.data.accountCount,
        syncedGroups: response.data.groupCount,
      };
    } catch (error: any) {
      console.error('Tally master data sync failed:', error);
      return {
        success: false,
        syncedAccounts: 0,
        syncedGroups: 0,
        error: error.response?.data?.message || 'Sync failed',
      };
    }
  }

  async getAccountGroups(): Promise<Array<{
    id: string;
    name: string;
    type: string;
    parent?: string;
  }>> {
    try {
      const response = await api.get('/integrations/tally/account-groups');
      return response.data;
    } catch (error) {
      console.error('Failed to get account groups:', error);
      return [];
    }
  }

  async mapInvoiceToVoucher(invoiceId: string, mapping: {
    salesAccount: string;
    taxAccount: string;
    partyLedger: string;
    narration?: string;
  }): Promise<boolean> {
    try {
      await api.post(`/integrations/tally/invoices/${invoiceId}/map`, mapping);
      return true;
    } catch (error) {
      console.error('Failed to map invoice to voucher:', error);
      return false;
    }
  }

  generateTallyXML(invoices: Invoice[], clients: Client[]): string {
    // Generate Tally XML format for invoices
    const clientMap = new Map(clients.map(client => [client.id, client]));

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>$$SvcCurrentCompany</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>`;

    // Add parties (clients)
    for (const client of clients) {
      xml += `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <PARTY NAME="${client.name}" RESERVEDNAME="">
            <MAILINGNAME.LIST>
              <MAILINGNAME>${client.name}</MAILINGNAME>
            </MAILINGNAME.LIST>
            <ADDRESS.LIST>
              <ADDRESS>${client.address || ''}</ADDRESS>
            </ADDRESS.LIST>
            <EMAIL>${client.email || ''}</EMAIL>
            <PINCODE>${client.pincode || ''}</PINCODE>
            <PHONE>${client.phone || ''}</PHONE>
            <PARTYLEDGERGROUPNAME>Sundry Debtors</PARTYLEDGERGROUPNAME>
            <CURRENCYNAME>₹</CURRENCYNAME>
            <ISBILLWISEON>Yes</ISBILLWISEON>
            <ISCREDITDAYSCHKON>No</ISCREDITDAYSCHKON>
            <ISINTERESTON>No</ISINTERESTON>
            <ALLOWINMOBILE>No</ALLOWINMOBILE>
            <ISCOSTCENTRESON>No</ISCOSTCENTRESON>
          </PARTY>
        </TALLYMESSAGE>`;
    }

    // Add vouchers (invoices)
    for (const invoice of invoices) {
      const client = clientMap.get(invoice.clientId);
      const invoiceDate = new Date(invoice.issueDate).toISOString().split('T')[0].replace(/-/g, '');

      xml += `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER REMOTEID="" VCHKEY="" VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
            <DATE>${invoiceDate}</DATE>
            <NARRATION>Invoice ${invoice.number}</NARRATION>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${invoice.number}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${client?.name || 'Unknown'}</PARTYLEDGERNAME>
            <BASICBUYERNAME>${client?.name || 'Unknown'}</BASICBUYERNAME>
            <CSTFORMISSUETYPE/>
            <CSTFORMRECVTYPE/>
            <FBTPAYMENTTYPE>Default</FBTPAYMENTTYPE>
            <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
            <VCHGSTCLASS/>
            <DIFFACTUALQTY>No</DIFFACTUALQTY>
            <ISMSTFROMSYNC>No</ISMSTFROMSYNC>
            <ASORIGINAL>No</ASORIGINAL>
            <AUDITED>No</AUDITED>
            <ISCOMMONPARTY>No</ISCOMMONPARTY>
            <FORJOBCOSTING>No</FORJOBCOSTING>
            <ISOPTIONAL>No</ISOPTIONAL>
            <EFFECTIVEDATE>${invoiceDate}</EFFECTIVEDATE>
            <USEFOREXCISE>No</USEFOREXCISE>
            <ISFORJOBWORKIN>No</ISFORJOBWORKIN>
            <ALLOWCONSUMPTION>No</ALLOWCONSUMPTION>
            <USEFORINTEREST>No</USEFORINTEREST>
            <USEFORGAINLOSS>No</USEFORGAINLOSS>
            <USEFORGODOWNTRANSFER>No</USEFORGODOWNTRANSFER>
            <USEFORCOMPOUND>No</USEFORCOMPOUND>
            <USEFORSERVICETAX>No</USEFORSERVICETAX>
            <ISEXCISEVOUCHER>No</ISEXCISEVOUCHER>
            <EXCISETAXOVERRIDE>No</EXCISETAXOVERRIDE>
            <USEFORTAXUNITTRANSFER>No</USEFORTAXUNITTRANSFER>
            <IGNOREPOSVALIDATION>No</IGNOREPOSVALIDATION>
            <EXCISEOPENING>No</EXCISEOPENING>
            <USEFORFINALPRODUCTION>No</USEFORFINALPRODUCTION>
            <ISTDSOVERRIDDEN>No</ISTDSOVERRIDDEN>
            <ISTCSOVERRIDDEN>No</ISTCSOVERRIDDEN>
            <ISTDSTCSCASHVCH>No</ISTDSTCSCASHVCH>
            <INCLUDEADVPYMTVCH>No</INCLUDEADVPYMTVCH>
            <ISSUBWORKSCONTRACT>No</ISSUBWORKSCONTRACT>
            <ISVATOVERRIDDEN>No</ISVATOVERRIDDEN>
            <IGNOREORIGVCHDATE>No</IGNOREORIGVCHDATE>
            <ISVATPAIDATCUSTOMS>No</ISVATPAIDATCUSTOMS>
            <ISDECLAREDTOCUSTOMS>No</ISDECLAREDTOCUSTOMS>
            <VATADVANCEPAID>No</VATADVANCEPAID>
            <VATADVPAYMENT>No</VATADVPAYMENT>
            <ISCSTDELLASTMONTH>No</ISCSTDELLASTMONTH>
            <ISVATDELLASTMONTH>No</ISVATDELLASTMONTH>
            <ISEXCISECLEARED>No</ISEXCISECLEARED>
            <ISEXCISEMANUFREMOVED>No</ISEXCISEMANUFREMOVED>
            <ISBLANKCHEQUE>No</ISBLANKCHEQUE>
            <ISVOID>No</ISVOID>
            <ORDERLINESTATUS>No</ORDERLINESTATUS>
            <VATISAGNSTCANCSALES>No</VATISAGNSTCANCSALES>
            <VATISPURCEXEMPTED>No</VATISPURCEXEMPTED>
            <ISVATRESTAXINV>No</ISVATRESTAXINV>
            <VATISASSESABLECALCVCH>No</VATISASSESABLECALCVCH>
            <ISVATDELETEDVCHFROMLST>No</ISVATDELETEDVCHFROMLST>
            <ISVATISPURCRETURN>No</ISVATISPURCRETURN>
            <ISEXEMPTED>No</ISEXEMPTED>
            <ISCANCELLED>No</ISCANCELLED>
            <HASCASHFLOW>Yes</HASCASHFLOW>
            <ISPOSTDATED>No</ISPOSTDATED>
            <USETRACKINGNUMBER>No</USETRACKINGNUMBER>
            <ISINVOICE>Yes</ISINVOICE>
            <MFGJOURNAL>No</MFGJOURNAL>
            <HASDISCOUNTS>No</HASDISCOUNTS>
            <ASPAYSLIP>No</ASPAYSLIP>
            <ISCOSTCENTRE>No</ISCOSTCENTRE>
            <ISSTXNONREALIZEDVCH>No</ISSTXNONREALIZEDVCH>
            <ISEXCISEADJUSTMENTVCH>No</ISEXCISEADJUSTMENTVCH>
            <ISBILLWISEON>Yes</ISBILLWISEON>
            <ISCOSTTRACKINGON>No</ISCOSTTRACKINGON>
            <ISBNFCODESUPPORTED>No</ISBNFCODESUPPORTED>
            <ISGSTOVERRIDDEN>No</ISGSTOVERRIDDEN>
            <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>
            <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>
            <STRDGSTISPARTIALLYEXEMPTED>No</STRDGSTISPARTIALLYEXEMPTED>
            <STRDGSTISREVERSECHARGEAPPLIED>No</STRDGSTISREVERSECHARGEAPPLIED>
            <STRDGSTISITCELIGIBLE>No</STRDGSTISITCELIGIBLE>
            <STRDGSTISITCBLOCKED>No</STRDGSTISITCBLOCKED>
            <STRDGSTISITCFROZEN>No</STRDGSTISITCFROZEN>
            <STRDGSTISGSTONADVANCES>No</STRDGSTISGSTONADVANCES>
            <STRDGSTISREVERSECHARGETAX>No</STRDGSTISREVERSECHARGETAX>
            <STRDGSTRETURNADJ>No</STRDGSTRETURNADJ>
            <STRDGSTISOTHERGST>No</STRDGSTISOTHERGST>
            <STRDGSTISFOREIGNGST>No</STRDGSTISFOREIGNGST>
            <STRDGSTISCANCELLED>No</STRDGSTISCANCELLED>
            <STRDGSTISDELETED>No</STRDGSTISDELETED>
            <STRDGSTISEXEMPTED>No</STRDGSTISEXEMPTED>
            <STRDGSTISROUNDINGDIFF>No</STRDGSTISROUNDINGDIFF>
            <ROUNDINGMETHOD>Normal Rounding</ROUNDINGMETHOD>
            <SUBTOTAL>${invoice.subtotal}</SUBTOTAL>
            <TOTAL>${invoice.total}</TOTAL>`;

      // Add invoice items
      for (const item of invoice.items) {
        xml += `
            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>${item.description}</STOCKITEMNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>
              <ISAUTONEGATE>No</ISAUTONEGATE>
              <ISCUSTOMSCLEARANCE>No</ISCUSTOMSCLEARANCE>
              <ISTRACKCOMPONENT>No</ISTRACKCOMPONENT>
              <ISTRACKPRODUCTION>No</ISTRACKPRODUCTION>
              <ISPRIMARYITEM>No</ISPRIMARYITEM>
              <ISSCRAP>No</ISSCRAP>
              <RATE>${item.rate}/${item.unit || 'Nos'}</RATE>
              <AMOUNT>${item.amount}</AMOUNT>
              <ACTUALQTY>${item.quantity} ${item.unit || 'Nos'}</ACTUALQTY>
              <BILLEDQTY>${item.quantity} ${item.unit || 'Nos'}</BILLEDQTY>
            </ALLINVENTORYENTRIES.LIST>`;
      }

      // Add accounting entries
      xml += `
            <LEDGERENTRIES.LIST>
              <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <LEDGERNAME>${client?.name || 'Unknown'}</LEDGERNAME>
              <GSTCLASS/>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <LEDGERFROMITEM>No</LEDGERFROMITEM>
              <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <AMOUNT>${invoice.total}</AMOUNT>
              <BANKALLOCATIONS.LIST>
                <DATE>${invoiceDate}</DATE>
                <BILLTYPE>New Ref</BILLTYPE>
                <NAME>${invoice.number}</NAME>
                <BILLCREDITPERIOD>30 Days</BILLCREDITPERIOD>
                <AMOUNT>${invoice.total}</AMOUNT>
              </BANKALLOCATIONS.LIST>
            </LEDGERENTRIES.LIST>
            <LEDGERENTRIES.LIST>
              <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <LEDGERNAME>Sales Account</LEDGERNAME>
              <GSTCLASS/>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <LEDGERFROMITEM>No</LEDGERFROMITEM>
              <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
              <ISPARTYLEDGER>No</ISPARTYLEDGER>
              <AMOUNT>-${invoice.subtotal}</AMOUNT>
            </LEDGERENTRIES.LIST>`;

      // Add tax entries if applicable
      if (invoice.taxAmount > 0) {
        xml += `
            <LEDGERENTRIES.LIST>
              <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <LEDGERNAME>GST @ ${invoice.taxRate}%</LEDGERNAME>
              <GSTCLASS/>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <LEDGERFROMITEM>No</LEDGERFROMITEM>
              <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
              <ISPARTYLEDGER>No</ISPARTYLEDGER>
              <AMOUNT>-${invoice.taxAmount}</AMOUNT>
            </LEDGERENTRIES.LIST>`;
      }

      xml += `
          </VOUCHER>
        </TALLYMESSAGE>`;
    }

    xml += `
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    return xml;
  }

  async validateData(invoices: Invoice[]): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const invoice of invoices) {
      if (!invoice.number) {
        errors.push(`Invoice ${invoice.id} is missing invoice number`);
      }

      if (!invoice.clientId) {
        errors.push(`Invoice ${invoice.number} is missing client information`);
      }

      if (invoice.items.length === 0) {
        errors.push(`Invoice ${invoice.number} has no items`);
      }

      if (invoice.total <= 0) {
        warnings.push(`Invoice ${invoice.number} has zero or negative total`);
      }

      for (const item of invoice.items) {
        if (!item.description) {
          errors.push(`Invoice ${invoice.number} has item without description`);
        }
        if (item.quantity <= 0) {
          warnings.push(`Invoice ${invoice.number} has item with zero quantity`);
        }
        if (item.rate <= 0) {
          warnings.push(`Invoice ${invoice.number} has item with zero rate`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

export const tallyService = new TallyService();