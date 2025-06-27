// src/app/invoice-form/invoice.service.ts
import { Injectable } from '@angular/core';
import {
  collection, addDoc, getDocs, updateDoc, doc, deleteDoc, CollectionReference, DocumentReference,
  query, where, writeBatch, getDoc, runTransaction
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getStorage, StorageReference } from 'firebase/storage';
import { db } from '../../main';
import { Invoice, Payment } from '../core/models/app.models';

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  private invoicesRef: CollectionReference;
  private paymentsRef: CollectionReference;
  private storage = getStorage();

  constructor() {
    this.invoicesRef = collection(db, 'invoices');
    this.paymentsRef = collection(db, 'payments');
  }

  async createInvoice(invoiceData: Omit<Invoice, 'id' | 'paymentStatus' | 'totalPaid'>): Promise<string> {
    try {
      const fullInvoiceData: Omit<Invoice, 'id'> = {
        ...invoiceData,
        paymentStatus: 'Unpaid',
        totalPaid: 0,
        // dueDate can be set here if there's a default logic, e.g., net 30
      };
      const docRef: DocumentReference = await addDoc(this.invoicesRef, fullInvoiceData);
      return docRef.id;
    } catch (error) {
      console.error("Error creating invoice:", error);
      throw error;
    }
  }

  async uploadLogo(file: File): Promise<string> {
    try {
      const storageRef: StorageReference = ref(this.storage, 'logos/' + file.name);
      await uploadBytes(storageRef, file);
      const logoUrl = await getDownloadURL(storageRef);
      // console.log('Logo URL:', logoUrl); // Keep for debugging if needed, or remove
      return logoUrl;
    } catch (error) {
      console.error("Error uploading logo:", error);
      throw error;
    }
  }

  async getInvoices(): Promise<Invoice[]> {
    try {
      const snapshot = await getDocs(this.invoicesRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
    } catch (error) {
      console.error("Error fetching invoices:", error);
      throw error;
    }
  }

  async updateInvoice(id: string, data: Partial<Invoice>): Promise<void> {
    try {
      const invoiceRef: DocumentReference = doc(db, 'invoices', id);
      await updateDoc(invoiceRef, data);
    } catch (error) {
      console.error("Error updating invoice:", error);
      throw error;
    }
  }

  async deleteInvoice(id: string): Promise<void> {
    try {
      const invoiceRef: DocumentReference = doc(db, 'invoices', id);
      await deleteDoc(invoiceRef);
    } catch (error) {
      console.error("Error deleting invoice:", error);
      throw error;
    }
  }

  // Removed addCustomer and getCustomers as they are consolidated in CustomerService

  async recordPayment(paymentData: Omit<Payment, 'id'>): Promise<string> {
    // For production, wrap the addPayment and updateInvoiceInTransaction in a single Firestore transaction
    // to ensure atomicity. The current implementation does them sequentially.
    try {
      const paymentDocRef = await addDoc(this.paymentsRef, paymentData);

      // Update the corresponding invoice
      const invoiceRef = doc(this.invoicesRef, paymentData.invoiceId);
      const invoiceSnap = await getDoc(invoiceRef);

      if (!invoiceSnap.exists()) {
        throw new Error(`Invoice with ID ${paymentData.invoiceId} not found.`);
      }

      const invoice = invoiceSnap.data() as Invoice;
      const newTotalPaid = (invoice.totalPaid || 0) + paymentData.amountPaid;
      let newPaymentStatus: Invoice['paymentStatus'] = 'Partially Paid';

      if (newTotalPaid >= invoice.total) {
        newPaymentStatus = 'Paid';
      } else if (newTotalPaid === 0) {
        newPaymentStatus = 'Unpaid'; // Should not happen if adding payment, but good for completeness
      }
      // Overdue status would need to be checked against dueDate, potentially by a separate process or on load.

      await updateDoc(invoiceRef, {
        totalPaid: newTotalPaid,
        paymentStatus: newPaymentStatus
      });

      return paymentDocRef.id;
    } catch (error) {
      console.error("Error recording payment:", error);
      throw error;
    }
  }

  async getPaymentsForInvoice(invoiceId: string): Promise<Payment[]> {
    try {
      const q = query(this.paymentsRef, where("invoiceId", "==", invoiceId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
    } catch (error) {
      console.error(`Error fetching payments for invoice ${invoiceId}:`, error);
      throw error;
    }
  }

  async getAllPayments(): Promise<Payment[]> {
    try {
      // Consider adding orderBy('paymentDate', 'desc') if needed, but for aggregation, order might not matter.
      const snapshot = await getDocs(this.paymentsRef);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        // Ensure paymentDate is converted to JS Date for consistency
        // Use bracket notation for index signature access if 'data' is not strongly typed here
        const paymentDateValue = data['paymentDate'] as any;
        return {
          id: doc.id,
          ...data,
          paymentDate: paymentDateValue && paymentDateValue.toDate ? paymentDateValue.toDate() : new Date(paymentDateValue)
        } as Payment;
      });
    } catch (error) {
      console.error("Error fetching all payments:", error);
      throw error;
    }
  }
}
