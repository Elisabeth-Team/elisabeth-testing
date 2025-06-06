import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const pulumiConfig = new pulumi.Config();

// Create an S3 bucket
const bucket = new aws.s3.Bucket("my-bucket", {
  website: {
    indexDocument: "index.html",
  },
});

// Upload the image to the bucket
const image = new aws.s3.BucketObject("image.jpg", {
  bucket: bucket.id,
  source: new pulumi.asset.FileAsset(pulumiConfig.get("IMAGE_PATH") ?? ""), // Update this path
});

// Upload the index.html to the bucket
const indexHtml = new aws.s3.BucketObject("index.html", {
  bucket: bucket.id,
  content: `<html><body><img src="image.jpg" /></body></html>`,
  contentType: "text/html",
});

// Create a bucket policy to restrict access to your IP
const bucketPolicy = new aws.s3.BucketPolicy("bucketPolicy", {
  bucket: bucket.id,
  policy: pulumi.output(bucket.arn).apply((arn) =>
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: "*",
          Action: "s3:GetObject",
          Resource: `${arn}/*`,
          Condition: {
            IpAddress: {
              "aws:SourceIp": pulumiConfig.get("MY_IP"), // Replace with your IP address
            },
          },
        },
      ],
    })
  ),
});

export const websiteUrl = bucket.websiteEndpoint;
