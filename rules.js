// rules.js
// Export an array of rule objects with stable IDs
const RULES = [
  {
    id: 'engine-oil-filter',
    item: 'Engine Oil & Filter (Always change together)',
    standard: 10000,
    additional: 5000,
    action: 'Replace',
    category: 'Engine',
    part: '90915-20003 (Filter)'
  },
  {
    id: 'oil-pickup-screen',
    item: 'Oil Pickup Screen Inspection',
    standard: 10000,
    additional: 5000,
    action: 'Inspect (Check for carbon buildup via sump drain hole with camera)',
    category: 'Engine',
    part: 'N/A'
  },
  {
    id: 'brake-pads-discs',
    item: 'Brake Pads & Discs',
    standard: 10000,
    additional: 5000,
    action: 'Inspect',
    category: 'Chassis & Body',
    part: '04465-60280 (Front) / 04466-60140 (Rear)'
  },
  {
    id: 'engine-air-filter',
    item: 'Engine Air Cleaner Filter',
    standard: 30000,
    additional: 30000,
    action: 'Replace',
    category: 'Engine',
    part: '17801-30080'
  },
  // Add more rules as needed. Keeping the set small for initial refactor.
];

// Make available globally for the simple script loader used in index.html
window.RULES = RULES;
