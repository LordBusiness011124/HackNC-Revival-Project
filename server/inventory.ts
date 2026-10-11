export type PartStatus = 'available' | 'reserved' | 'needed';
export type InventoryDevice = {
  id: string; owner: string; model: string; condition: string;
  role: 'repair-target' | 'donor' | 'unmatched';
  location: { name: string; lat: number; lng: number };
  parts: { name: string; status: PartStatus }[];
};
// Fictional demo devices. Locations are public campus spots used as drop-off points.
export const seedInventory: InventoryDevice[] = [
  { id: 'dev-alex-demobook', owner: 'Alex', model: 'DemoBook 14', condition: 'Cracked display', role: 'repair-target', location: { name: 'Davis Library', lat: 35.9108, lng: -79.0481 }, parts: [{ name: 'Display assembly', status: 'needed' }, { name: 'Mainboard', status: 'available' }, { name: 'Keyboard', status: 'available' }, { name: 'Battery', status: 'available' }] },
  { id: 'dev-maya-demobook', owner: 'Maya', model: 'DemoBook 14', condition: 'Failed mainboard', role: 'donor', location: { name: 'Sitterson Hall', lat: 35.9097, lng: -79.0532 }, parts: [{ name: 'Display assembly', status: 'available' }] },
  { id: 'dev-campus-minipc', owner: 'Repair club', model: 'Mini PC', condition: 'Missing power adapter', role: 'unmatched', location: { name: 'Carrboro Town Commons', lat: 35.9108, lng: -79.0753 }, parts: [{ name: 'Mainboard', status: 'available' }, { name: 'Memory', status: 'available' }, { name: 'Storage', status: 'available' }] },
];
