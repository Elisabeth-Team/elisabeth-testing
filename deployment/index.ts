import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const pulumiConfig = new pulumi.Config();

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

// Create Lambda function
const lambda = new aws.lambda.Function("api-lambda", {
  code: new pulumi.asset.AssetArchive({
    ".": new pulumi.asset.StringAsset(`
exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  const response = {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      message: 'Hello from Lambda!',
      requestId: event.requestContext?.requestId,
      path: event.path,
      method: event.httpMethod,
    }),
  };
  
  return response;
};
    `),
  }),
  handler: "index.handler",
  runtime: aws.lambda.Runtime.NodeJS18dX,
  role: lambdaRole.arn,
});

// Create API Gateway
const api = new aws.apigateway.RestApi("api-gateway", {
  description: "API Gateway fronting Lambda function",
});

// Create API Gateway resource for proxy
const proxyResource = new aws.apigateway.Resource("proxy-resource", {
  restApi: api.id,
  parentId: api.rootResourceId,
  pathPart: "{proxy+}",
});

// Create API Gateway method for ANY requests
const proxyMethod = new aws.apigateway.Method("proxy-method", {
  restApi: api.id,
  resourceId: proxyResource.id,
  httpMethod: "ANY",
  authorization: "NONE",
});

// Create root method for requests to /
const rootMethod = new aws.apigateway.Method("root-method", {
  restApi: api.id,
  resourceId: api.rootResourceId,
  httpMethod: "ANY",
  authorization: "NONE",
});

// Create Lambda permission for API Gateway
const lambdaPermission = new aws.lambda.Permission("lambda-permission", {
  action: "lambda:InvokeFunction",
  function: lambda.name,
  principal: "apigateway.amazonaws.com",
  sourceArn: pulumi.interpolate`${api.executionArn}/*/*`,
});

// Create API Gateway integration for proxy
const proxyIntegration = new aws.apigateway.Integration("proxy-integration", {
  restApi: api.id,
  resourceId: proxyResource.id,
  httpMethod: proxyMethod.httpMethod,
  integrationHttpMethod: "POST",
  type: "AWS_PROXY",
  uri: lambda.invokeArn,
});

// Create API Gateway integration for root
const rootIntegration = new aws.apigateway.Integration("root-integration", {
  restApi: api.id,
  resourceId: api.rootResourceId,
  httpMethod: rootMethod.httpMethod,
  integrationHttpMethod: "POST",
  type: "AWS_PROXY",
  uri: lambda.invokeArn,
});

// Create API Gateway deployment
const deployment = new aws.apigateway.Deployment(
  "api-deployment",
  {
    restApi: api.id,
  },
  {
    dependsOn: [proxyIntegration, rootIntegration],
  }
);

export const apiUrl = pulumi.interpolate`${deployment.invokeUrl}`;
export const lambdaArn = lambda.arn;
