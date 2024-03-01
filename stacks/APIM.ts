import { 
  Function,
  StackContext,
  StaticSite,
  
  Table,
  ApiGatewayV1Api,
  Bucket,
  Queue } from "sst/constructs";
import { Role,ServicePrincipal,PolicyStatement,Effect } from "aws-cdk-lib/aws-iam";
import { RemovalPolicy } from "aws-cdk-lib";
import { attachPermissionsToRole } from "sst/constructs";
import { Duration } from "aws-cdk-lib";

export function API({stack}: StackContext) {

  const role = new Role(stack, "ApiRole", {
    assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
    managedPolicies: [
      {
        managedPolicyArn:
          "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
      },
    ],
  });
  
  const bedrockPolicy = new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["bedrock:*"], // replace with actual bedrock actions
    resources: ["*"], // replace with actual resources
  });
  
  role.addToPolicy(bedrockPolicy);
  
  const s3Bucket = new Bucket(stack, "Bucket", {
    blockPublicACLs: true,
    cors: [
      {
        allowedHeaders: ["*"],
        allowedMethods: ["GET","PUT","POST"],
        allowedOrigins: ["*"],
      }
    ],
  });

  const documentTable = new Table(stack, "DocumentTable", {
    fields: {
      userid: "string",
      documentid: "string"
    },
    primaryIndex: { partitionKey: "userid", sortKey: "documentid" },
    stream: true,
    cdk: {
      table: {
        removalPolicy: RemovalPolicy.DESTROY
      },
    }
  });

  const memoryTable = new Table(stack, "MemoryTable", {
    fields: {
      SessionId: "string",
    },
    primaryIndex: { partitionKey: "SessionId" },
    stream: true,
    cdk: {
      table: {
        removalPolicy: RemovalPolicy.DESTROY
      },
    }
  });

  const EmbeddingQueue = new Queue(stack, "Queue", {
    cdk: {
      queue: {
        visibilityTimeout: Duration.seconds(180),
        retentionPeriod: Duration.seconds(3600),
      },
    }
  });

  // Attach permissions to role
  attachPermissionsToRole(role, [
    s3Bucket,
    documentTable,
    memoryTable,
    EmbeddingQueue
  ]);

  stack.setDefaultFunctionProps({
    runtime: "python3.11",
    role,
    timeout: 180,
    environment: {
      PRIMARY_KEY: 'id',
      DOCUMENT_TABLE: documentTable.tableName,
      MEMORY_TABLE: memoryTable.tableName,
      BUCKET: s3Bucket.bucketName,
      QUEUE: EmbeddingQueue.queueName
    }
  });

  s3Bucket.addNotifications(stack, {
    myNotification: "packages/functions/src/upload_trigger/main.lambda_handler",
  });

  const GenerateEmbeddings = new Function(stack, "GenerateEmbeddings", {
    runtime: "container",
    handler: "packages/functions/src/generate_embeddings",
    timeout: 180,
  });

  const addConversation = new Function(stack, "addConversation", {
    runtime: "container",
    handler: "packages/functions/src/add_conversation",
    timeout: 180,
  });

  //const GenerateEmbeddings = new Function(stack, "GenerateEmbeddings", {
  //  //runtime: "container",
  //  handler: "packages/functions/src/generate_embeddings/main.lambda_hanlder",
  //  timeout: 180,
  //});

  EmbeddingQueue.addConsumer(stack, GenerateEmbeddings);

  const api = new ApiGatewayV1Api(stack, "Api", {
    routes: {
      "POST /doc/{documentid}": {
        function: addConversation,
    },         
      "GET /generate_presigned_url": {
        function: "packages/functions/src/generate_presigned_url/main.lambda_handler",
    },
      "POST /{documentid}/{conversationid}": {
        function: "packages/functions/src/generate_response/main.lambda_handler",
    },
      "GET /doc": {
        function: "packages/functions/src/get_all_documents/main.lambda_handler",
    },
      "GET /doc/{documentid}/{conversationid}": {
        function: "packages/functions/src/get_document/main.lambda_handler",
    },   
  },
    cdk: {
      restApi: {
        restApiName: 'Items Service'
      }
    }
  });

  const site = new StaticSite(stack, "ReactSite", {
    path: "packages/frontend",
    buildCommand: "npm run build",
    buildOutput: "dist",
    environment: {
      REACT_APP_API_URL: api.url,
      VITE_REGION: "us-east-1",
      VITE_API_ENDPOINT: api.url,
      VITE_USER_POOL_ID: "us-east-1_j7oks4kpJ",
      VITE_USER_POOL_CLIENT_ID: "5mot32mbqoai7dve99gmiaahuk"
    },
  });

  // Show the URLs in the output
  stack.addOutputs({
    SiteUrl: site.url,
    ApiEndpoint: api.url,
  });
}


