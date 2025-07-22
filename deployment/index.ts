import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { ApiGatewayComponent } from "./apiGatewayComponent";

// Create IAM role for Lambda
const lambdaRole = new aws.iam.Role("lambda-role", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Effect: "Allow",
        Principal: {
          Service: "lambda.amazonaws.com",
        },
      },
    ],
  }),
});

// Attach basic execution policy to Lambda role
const lambdaRolePolicy = new aws.iam.RolePolicyAttachment(
  "lambda-role-policy",
  {
    role: lambdaRole.name,
    policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
  }
);

// Create API Gateway instances using the component
const apiGateway1 = new ApiGatewayComponent("api-gateway-1", {
  name: "api-gateway-1",
  lambdaCodePath: "deployment/lambda1",
  lambdaRole: lambdaRole,
});

const apiGateway2 = new ApiGatewayComponent("api-gateway-2", {
  name: "api-gateway-2",
  lambdaCodePath: "deployment/lambda2",
  lambdaRole: lambdaRole,
});

export const apiUrl1 = apiGateway1.outputs.apiUrl;
export const apiUrl2 = apiGateway2.outputs.apiUrl;
export const lambda1Arn = apiGateway1.outputs.lambdaArn;
export const lambda2Arn = apiGateway2.outputs.lambdaArn;
