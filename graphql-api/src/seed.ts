import { firestore } from "./firestore.js";
import type { Coordinates, PersonRecord } from "./persons.js";

function randomCoordinates(): Coordinates {
  return {
    lat: Number((Math.random() * 180 - 90).toFixed(4)),
    lng: Number((Math.random() * 360 - 180).toFixed(4)),
  };
}

// Dummy data only. SSN and card numbers below are well-known
// test/placeholder values (e.g. 4111 1111 1111 1111 is Visa's public test
// card number) - not real people or real financial data. Location is
// randomly generated on each seed run, not a real tracked position.
const people: PersonRecord[] = [
  {
    id: "person1",
    userName: "Alice Morgan",
    gender: "Female",
    country: "United States",
    age: 29,
    dob: "1997-03-14",
    socials: "@alice.codes",
    imageUrl: "https://i.pravatar.cc/150?img=1",
    ssn: "123-45-6789",
    contact: "+1-555-0101",
    creditCardNumber: "4111 1111 1111 1111",
    dlNumber: "D1234567",
    lastKnownLocation: randomCoordinates(),
  },
  {
    id: "person2",
    userName: "Ben Carter",
    gender: "Male",
    country: "United Kingdom",
    age: 34,
    dob: "1992-07-22",
    socials: "@bencarter",
    imageUrl: "https://i.pravatar.cc/150?img=2",
    ssn: "987-65-4321",
    contact: "+44-20-7946-0102",
    creditCardNumber: "5500 0000 0000 0004",
    dlNumber: "D7654321",
    lastKnownLocation: randomCoordinates(),
  },
  {
    id: "person3",
    userName: "Priya Nandan",
    gender: "Female",
    country: "India",
    age: 41,
    dob: "1985-01-09",
    socials: "@priya.n",
    imageUrl: "https://i.pravatar.cc/150?img=3",
    ssn: "555-12-3456",
    contact: "+91-98765-43210",
    creditCardNumber: "3400 0000 0000 009",
    dlNumber: "D1122334",
    lastKnownLocation: randomCoordinates(),
  },
];

async function seed() {
  const batch = firestore.batch();
  for (const person of people) {
    const { id, ...data } = person;
    batch.set(firestore.collection("persons").doc(id), data);
  }
  await batch.commit();
  console.log(`Seeded ${people.length} persons.`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
