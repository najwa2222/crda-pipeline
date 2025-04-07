// utils/database.js
export async function deleteDatabase() {
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
  }