import 'jspdf'; // Import to augment the original module

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF; // Defines the autoTable method on jsPDF instances
  }
}
