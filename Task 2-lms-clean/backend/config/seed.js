require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./db');

const seed = async () => {
  await connectDB();

  const db = mongoose.connection;
  await db.collection('users').deleteMany({});
  await db.collection('books').deleteMany({});
  console.log('Cleared existing data');

  // Hash passwords manually and insert directly - bypasses mongoose hooks
  const adminHash = await bcrypt.hash('admin123', 12);
  const userHash = await bcrypt.hash('user123', 12);

  await db.collection('users').insertMany([
    {
      name: 'Admin User',
      email: 'admin@library.com',
      password: adminHash,
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: 'Jane Reader',
      email: 'jane@example.com',
      password: userHash,
      role: 'user',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  await db.collection('books').insertMany([
    { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', ISBN: '978-0743273565', genre: 'Fiction', description: 'A story of the fabulously wealthy Jay Gatsby.', quantity: 5, availableCopies: 5, publishedYear: 1925, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { title: 'To Kill a Mockingbird', author: 'Harper Lee', ISBN: '978-0061935466', genre: 'Fiction', description: 'The story of racial injustice in the Deep South.', quantity: 4, availableCopies: 4, publishedYear: 1960, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { title: 'Sapiens', author: 'Yuval Noah Harari', ISBN: '978-0062316097', genre: 'Non-Fiction', description: 'A brief history of humankind.', quantity: 6, availableCopies: 6, publishedYear: 2011, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { title: '1984', author: 'George Orwell', ISBN: '978-0451524935', genre: 'Dystopia', description: 'A chilling prophecy about the future.', quantity: 3, availableCopies: 3, publishedYear: 1949, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { title: 'Dune', author: 'Frank Herbert', ISBN: '978-0441013593', genre: 'Science Fiction', description: 'An epic planetary adventure.', quantity: 4, availableCopies: 4, publishedYear: 1965, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { title: 'Atomic Habits', author: 'James Clear', ISBN: '978-0735211292', genre: 'Self-Help', description: 'Tiny changes, remarkable results.', quantity: 7, availableCopies: 7, publishedYear: 2018, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { title: 'The Pragmatic Programmer', author: 'Andrew Hunt', ISBN: '978-0135957059', genre: 'Technology', description: 'Your journey to mastery.', quantity: 3, availableCopies: 3, publishedYear: 2019, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { title: 'Clean Code', author: 'Robert C. Martin', ISBN: '978-0132350884', genre: 'Technology', description: 'A handbook of agile software craftsmanship.', quantity: 4, availableCopies: 4, publishedYear: 2008, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ]);

  console.log('Seeded users:');
  console.log('  Admin: admin@library.com / admin123');
  console.log('  User:  jane@example.com  / user123');
  console.log('Seeded 8 books');

  await mongoose.disconnect();
  console.log('Seeding complete!');
  process.exit(0);
};

seed().catch((err) => { console.error(err); process.exit(1); });