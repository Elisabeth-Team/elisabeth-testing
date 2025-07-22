import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export interface ApiGatewayComponentArgs {
  name: string;
  lambdaCodePath: string;
  lambdaRole: aws.iam.Role;
}

export interface ApiGatewayComponentOutputs {
  apiUrl: pulumi.Output<string>;
  apiId: pulumi.Output<string>;
  deploymentId: pulumi.Output<string>;
  lambdaArn: pulumi.Output<string>;
}

export class ApiGatewayComponent extends pulumi.ComponentResource {
  public readonly outputs: ApiGatewayComponentOutputs;

  constructor(
    name: string,
    args: ApiGatewayComponentArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("custom:ApiGatewayComponent", name, {}, opts);

    const lambdaFunction = new aws.lambda.Function(
      `${args.name}-lambda`,
      {
        code: new pulumi.asset.FileArchive(args.lambdaCodePath),
        handler: "index.handler",
        runtime: aws.lambda.Runtime.NodeJS18dX,
        role: args.lambdaRole.arn,
      },
      { parent: this }
    );

    const api = new aws.apigateway.RestApi(
      `${args.name}-api-gateway`,
      {
        description: `API Gateway fronting Lambda function for ${args.name}`,
      },
      { parent: this }
    );

    const proxyResource = new aws.apigateway.Resource(
      `${args.name}-proxy-resource`,
      {
        restApi: api.id,
        parentId: api.rootResourceId,
        pathPart: "{proxy+}",
      },
      { parent: this }
    );

    const proxyMethod = new aws.apigateway.Method(
      `${args.name}-proxy-method`,
      {
        restApi: api.id,
        resourceId: proxyResource.id,
        httpMethod: "ANY",
        authorization: "NONE",
      },
      { parent: this }
    );

    const rootMethod = new aws.apigateway.Method(
      `${args.name}-root-method`,
      {
        restApi: api.id,
        resourceId: api.rootResourceId,
        httpMethod: "ANY",
        authorization: "NONE",
      },
      { parent: this }
    );

    const lambdaPermission = new aws.lambda.Permission(
      `${args.name}-lambda-permission`,
      {
        action: "lambda:InvokeFunction",
        function: lambdaFunction.name,
        principal: "apigateway.amazonaws.com",
        sourceArn: pulumi.interpolate`${api.executionArn}/*/*`,
      },
      { parent: this }
    );

    const proxyIntegration = new aws.apigateway.Integration(
      `${args.name}-proxy-integration`,
      {
        restApi: api.id,
        resourceId: proxyResource.id,
        httpMethod: proxyMethod.httpMethod,
        integrationHttpMethod: "POST",
        type: "AWS_PROXY",
        uri: lambdaFunction.invokeArn,
      },
      { parent: this }
    );

    const rootIntegration = new aws.apigateway.Integration(
      `${args.name}-root-integration`,
      {
        restApi: api.id,
        resourceId: api.rootResourceId,
        httpMethod: rootMethod.httpMethod,
        integrationHttpMethod: "POST",
        type: "AWS_PROXY",
        uri: lambdaFunction.invokeArn,
      },
      { parent: this }
    );

    const deployment = new aws.apigateway.Deployment(
      `${args.name}-api-deployment`,
      {
        restApi: api.id,
        stageName: "prod",
      },
      {
        dependsOn: [proxyIntegration, rootIntegration],
        parent: this,
      }
    );

    this.outputs = {
      apiUrl: pulumi.interpolate`https://${api.id}.execute-api.${aws.getRegionOutput().name}.amazonaws.com/prod`,
      apiId: api.id,
      deploymentId: deployment.id,
      lambdaArn: lambdaFunction.arn,
    };

    this.registerOutputs(this.outputs);
  }
}