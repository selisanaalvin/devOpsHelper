const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const REGION = "us-east-1";
const BUCKET_NAME = "TestS3Bucket";

const s3Client = new S3Client({ region: REGION });

exports.handler = async (event) => {
  const { httpMethod, pathParameters, body } = event;
  const key = pathParameters?.key;

  if (!key) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing object key in path parameters." }),
    };
  }

  try {
    switch (httpMethod) {
      case "PUT":
        if (!body) {
          return { statusCode: 400, body: JSON.stringify({ error: "Missing request body." }) };
        }
        await s3Client.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: body,
        }));
        return {
          statusCode: 200,
          body: JSON.stringify({ message: `Object '${key}' created/updated.` }),
        };

      case "GET":
        const getUrl = await getSignedUrl(s3Client, new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        }), { expiresIn: 3600 });
        return {
          statusCode: 200,
          body: JSON.stringify({ downloadUrl: getUrl }),
        };

      case "DELETE":
        await s3Client.send(new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        }));
        return {
          statusCode: 200,
          body: JSON.stringify({ message: `Object '${key}' deleted.` }),
        };

      default:
        return {
          statusCode: 405,
          body: JSON.stringify({ error: "Method Not Allowed" }),
        };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};