import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// MongoDB connection string - you should set this as an environment variable
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'result-testing';
const COLLECTION_NAME = 'result';

let client: MongoClient | null = null;

async function getMongoClient() {
  if (!client) {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
  }
  return client;
}

export async function POST(request: NextRequest) {
  try {
    // Parse the multipart form data
    const formData = await request.formData();
    
    // Extract the file named "errores"
    const erroresFile = formData.get('errores') as File;
    if (!erroresFile) {
      return NextResponse.json(
        { error: 'File "errores" is required' },
        { status: 400 }
      );
    }

    // Extract the JSON data
    const jsonDataString = formData.get('data') as string;
    if (!jsonDataString) {
      return NextResponse.json(
        { error: 'JSON data field "data" is required' },
        { status: 400 }
      );
    }

    let jsonData;
    try {
      jsonData = JSON.parse(jsonDataString);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON format in data field' },
        { status: 400 }
      );
    }

    // Read the file content
    const fileContent = await erroresFile.text();
    
    // Merge file content with JSON data
    const documentToInsert = {
      ...jsonData,
      errores: fileContent,
      fileInfo: {
        fileName: erroresFile.name,
        fileSize: erroresFile.size,
        fileType: erroresFile.type
      },
      createdAt: new Date(),
      _insertedAt: new Date().toISOString()
    };

    // Get MongoDB client and connect to database
    const mongoClient = await getMongoClient();
    const db = mongoClient.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Insert the document into the collection
    const result = await collection.insertOne(documentToInsert);

    return NextResponse.json(
      {
        success: true,
        message: 'Data and file saved successfully',
        insertedId: result.insertedId,
        data: {
          ...documentToInsert,
          errores: fileContent.length > 200 ? fileContent.substring(0, 200) + '...' : fileContent
        }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error saving data to MongoDB:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save data to database',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Optional: Add a GET method to retrieve data
export async function GET() {
  try {
    const mongoClient = await getMongoClient();
    const db = mongoClient.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Get the latest 10 documents
    const documents = await collection
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    return NextResponse.json({
      success: true,
      count: documents.length,
      data: documents
    });

  } catch (error) {
    console.error('Error retrieving data from MongoDB:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve data from database',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
