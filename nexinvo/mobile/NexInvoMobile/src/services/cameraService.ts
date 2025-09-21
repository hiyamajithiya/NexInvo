import { Alert, Platform } from 'react-native';
import { PERMISSIONS, request, check, RESULTS } from 'react-native-permissions';

export interface CapturedDocument {
  uri: string;
  width: number;
  height: number;
  type: 'image' | 'pdf';
  size: number;
  name: string;
}

export interface ScanOptions {
  detectText?: boolean;
  enhanceImage?: boolean;
  cropAutomatically?: boolean;
  outputFormat?: 'jpg' | 'png' | 'pdf';
  quality?: number; // 0-100
}

class CameraService {
  async requestCameraPermission(): Promise<boolean> {
    try {
      const permission = Platform.OS === 'ios'
        ? PERMISSIONS.IOS.CAMERA
        : PERMISSIONS.ANDROID.CAMERA;

      const result = await request(permission);
      return result === RESULTS.GRANTED;
    } catch (error) {
      console.error('Error requesting camera permission:', error);

      // Fallback permission request using Alert
      return new Promise((resolve) => {
        Alert.alert(
          'Camera Permission Required',
          'NexInvo needs camera access to scan documents and receipts for invoices.',
          [
            {
              text: 'Cancel',
              onPress: () => resolve(false),
              style: 'cancel',
            },
            {
              text: 'Grant Permission',
              onPress: () => resolve(true),
            },
          ]
        );
      });
    }
  }

  async checkCameraPermission(): Promise<boolean> {
    try {
      const permission = Platform.OS === 'ios'
        ? PERMISSIONS.IOS.CAMERA
        : PERMISSIONS.ANDROID.CAMERA;

      const result = await check(permission);
      return result === RESULTS.GRANTED;
    } catch (error) {
      console.error('Error checking camera permission:', error);
      return false;
    }
  }

  async scanDocument(options: ScanOptions = {}): Promise<CapturedDocument | null> {
    try {
      const hasPermission = await this.checkCameraPermission();
      if (!hasPermission) {
        const granted = await this.requestCameraPermission();
        if (!granted) {
          Alert.alert('Permission Denied', 'Camera access is required to scan documents.');
          return null;
        }
      }

      // In a real implementation, you would use react-native-document-scanner
      // or react-native-camera with document detection

      // For now, we'll simulate the document scanning process
      return new Promise((resolve) => {
        Alert.alert(
          'Document Scanner',
          'Document scanning will open the camera to capture and process documents.',
          [
            {
              text: 'Cancel',
              onPress: () => resolve(null),
              style: 'cancel',
            },
            {
              text: 'Open Camera',
              onPress: () => {
                // Simulate successful scan
                const mockDocument: CapturedDocument = {
                  uri: 'file://mock/document/scan.jpg',
                  width: 1920,
                  height: 1080,
                  type: 'image',
                  size: 245760, // 240KB
                  name: `scanned_document_${Date.now()}.jpg`,
                };
                resolve(mockDocument);
              },
            },
          ]
        );
      });
    } catch (error) {
      console.error('Error scanning document:', error);
      Alert.alert('Scan Error', 'Failed to scan document. Please try again.');
      return null;
    }
  }

  async scanReceipt(): Promise<CapturedDocument | null> {
    return this.scanDocument({
      detectText: true,
      enhanceImage: true,
      cropAutomatically: true,
      outputFormat: 'jpg',
      quality: 90,
    });
  }

  async scanBusinessCard(): Promise<CapturedDocument | null> {
    return this.scanDocument({
      detectText: true,
      enhanceImage: true,
      cropAutomatically: true,
      outputFormat: 'jpg',
      quality: 95,
    });
  }

  async captureInvoicePhoto(): Promise<CapturedDocument | null> {
    return this.scanDocument({
      enhanceImage: true,
      outputFormat: 'jpg',
      quality: 85,
    });
  }

  async extractTextFromImage(imageUri: string): Promise<string | null> {
    try {
      // In a real implementation, you would use:
      // - react-native-text-recognizer for on-device OCR
      // - Google ML Kit Text Recognition
      // - AWS Textract
      // - Azure Computer Vision

      // Simulate text extraction
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing time

      // Mock extracted text for receipts/invoices
      const mockExtractedText = `
        INVOICE
        Invoice #: INV-2023-001
        Date: ${new Date().toDateString()}

        Bill To:
        John Doe
        123 Main Street
        City, State 12345

        Description: Professional Services
        Amount: ₹5,000.00
        Tax: ₹900.00
        Total: ₹5,900.00

        Thank you for your business!
      `;

      return mockExtractedText.trim();
    } catch (error) {
      console.error('Error extracting text from image:', error);
      return null;
    }
  }

  async processReceiptData(extractedText: string): Promise<{
    amount?: number;
    date?: string;
    vendor?: string;
    items?: string[];
    tax?: number;
  } | null> {
    try {
      // Simple text parsing for common receipt patterns
      const lines = extractedText.split('\n').map(line => line.trim()).filter(Boolean);

      const result: any = {};

      // Extract amount (look for currency symbols and numbers)
      const amountPattern = /(?:₹|INR|Rs\.?)\s*([0-9,]+\.?[0-9]*)/i;
      const totalPattern = /total[:\s]+(?:₹|INR|Rs\.?)\s*([0-9,]+\.?[0-9]*)/i;

      for (const line of lines) {
        const totalMatch = line.match(totalPattern);
        if (totalMatch) {
          result.amount = parseFloat(totalMatch[1].replace(/,/g, ''));
          break;
        }

        const amountMatch = line.match(amountPattern);
        if (amountMatch && !result.amount) {
          result.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
        }
      }

      // Extract date
      const datePattern = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/;
      for (const line of lines) {
        const dateMatch = line.match(datePattern);
        if (dateMatch) {
          result.date = dateMatch[1];
          break;
        }
      }

      // Extract vendor (usually first few lines)
      if (lines.length > 0) {
        result.vendor = lines[0];
      }

      // Extract tax
      const taxPattern = /(?:tax|gst|vat)[:\s]+(?:₹|INR|Rs\.?)\s*([0-9,]+\.?[0-9]*)/i;
      for (const line of lines) {
        const taxMatch = line.match(taxPattern);
        if (taxMatch) {
          result.tax = parseFloat(taxMatch[1].replace(/,/g, ''));
          break;
        }
      }

      return result;
    } catch (error) {
      console.error('Error processing receipt data:', error);
      return null;
    }
  }

  async enhanceImage(imageUri: string): Promise<string | null> {
    try {
      // In a real implementation, you would use image processing libraries like:
      // - react-native-image-editor
      // - react-native-image-manipulator
      // - Native image processing APIs

      // Simulate image enhancement
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Return enhanced image URI (in reality, this would be processed)
      return imageUri.replace('.jpg', '_enhanced.jpg');
    } catch (error) {
      console.error('Error enhancing image:', error);
      return null;
    }
  }

  async convertToPDF(imageUris: string[], outputName?: string): Promise<string | null> {
    try {
      // In a real implementation, you would use:
      // - react-native-pdf-lib
      // - react-native-html-to-pdf
      // - Custom PDF generation library

      // Simulate PDF conversion
      await new Promise(resolve => setTimeout(resolve, 3000));

      const pdfName = outputName || `scanned_document_${Date.now()}.pdf`;
      const mockPdfUri = `file://mock/documents/${pdfName}`;

      Alert.alert(
        'PDF Created',
        `Document saved as ${pdfName}`,
        [{ text: 'OK' }]
      );

      return mockPdfUri;
    } catch (error) {
      console.error('Error converting to PDF:', error);
      Alert.alert('Conversion Error', 'Failed to convert images to PDF.');
      return null;
    }
  }

  async saveScanToGallery(imageUri: string): Promise<boolean> {
    try {
      // In a real implementation, you would use:
      // - @react-native-camera-roll/camera-roll
      // - react-native-fs for file operations

      // Simulate saving to gallery
      await new Promise(resolve => setTimeout(resolve, 1000));

      Alert.alert('Saved', 'Document scan saved to photo gallery.');
      return true;
    } catch (error) {
      console.error('Error saving to gallery:', error);
      Alert.alert('Save Error', 'Failed to save document to gallery.');
      return false;
    }
  }

  async getImageMetadata(imageUri: string): Promise<{
    width: number;
    height: number;
    size: number;
    type: string;
  } | null> {
    try {
      // In a real implementation, you would get actual image metadata
      // using react-native-image-size or similar

      // Mock metadata
      return {
        width: 1920,
        height: 1080,
        size: 245760,
        type: 'image/jpeg',
      };
    } catch (error) {
      console.error('Error getting image metadata:', error);
      return null;
    }
  }

  async compressImage(imageUri: string, quality: number = 80): Promise<string | null> {
    try {
      // In a real implementation, you would use:
      // - react-native-image-manipulator
      // - react-native-image-resizer

      // Simulate compression
      await new Promise(resolve => setTimeout(resolve, 1000));

      return imageUri.replace('.jpg', '_compressed.jpg');
    } catch (error) {
      console.error('Error compressing image:', error);
      return null;
    }
  }
}

export const cameraService = new CameraService();