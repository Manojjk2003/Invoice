import { Injectable } from '@angular/core';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../main';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  async getCustomers() {
    const customersRef = collection(db, 'customers');
    const snapshot = await getDocs(customersRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async addCustomer(customer: any) {
    const customersRef = collection(db, 'customers');
    await addDoc(customersRef, customer);
  }
}
