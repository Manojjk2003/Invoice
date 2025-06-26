// src/app/invoice-form/invoice.service.ts
import { Injectable } from '@angular/core';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getStorage } from 'firebase/storage';
import { db, storage } from '../../main'; // These are now exported from main.ts

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  async createInvoice(invoiceData: any) {
    const invoicesRef = collection(db, 'invoices');
    await addDoc(invoicesRef, invoiceData);
  }

  async uploadLogo(file: File): Promise<string> {
  const storage = getStorage();
  const storageRef = ref(storage, 'logos/' + file.name);
  await uploadBytes(storageRef, file);

  const logoUrl = await getDownloadURL(storageRef);
  console.log('Logo URL:', logoUrl);
  return logoUrl;
}

  async getInvoices() {
    const invoicesRef = collection(db, 'invoices');
    const snapshot = await getDocs(invoicesRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async updateInvoice(id: string, data: any) {
    const invoiceRef = doc(db, 'invoices', id);
    await updateDoc(invoiceRef, data);
  }

  async deleteInvoice(id: string) {
    const invoiceRef = doc(db, 'invoices', id);
    await deleteDoc(invoiceRef);
  }
  async addCustomer(customerData: any): Promise<string> {
    const customersRef = collection(db, 'customers');
    const docRef = await addDoc(customersRef, customerData);
    return docRef.id;
  }

  async getCustomers(): Promise<any[]> {
    const snapshot = await getDocs(collection(db, 'customers'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
   async getInvoiceById(id: string) {
    const invoiceRef = doc(db, 'invoices', id);
    const docSnap = await getDoc(invoiceRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      console.error("No such document!");
      return undefined; // Or throw an error
    }
  }
}
