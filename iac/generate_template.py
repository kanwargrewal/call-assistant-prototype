import os


def generate_cloudformation():
    # Default values - can be overridden by CloudFormation parameters
    default_bucket = os.environ.get("LAMBDA_S3_BUCKET", "my-bucket")
    default_key = os.environ.get("LAMBDA_S3_KEY", "lambda.zip")
    default_handler = os.environ.get("LAMBDA_HANDLER", "main.handler")
    default_runtime = os.environ.get("LAMBDA_RUNTIME", "python3.10")

    # Use f-string only for the parameters section with environment variables
    parameters_section = f"""
Parameters:
  LambdaS3Bucket:
    Type: String
    Default: {default_bucket}
    Description: S3 bucket containing Lambda deployment package
  
  LambdaS3Key:
    Type: String
    Default: {default_key}
    Description: S3 key for Lambda deployment package
  
  LambdaHandler:
    Type: String
    Default: {default_handler}
    Description: Lambda function handler
  
  LambdaRuntime:
    Type: String
    Default: {default_runtime}
    Description: Lambda runtime version
  
"""

    # Static resources section without f-string to avoid CloudFormation syntax conflicts
    resources_section = """

Resources:
  BackendFunction:
    Type: AWS::Lambda::Function
    Properties:
      Handler: !Ref LambdaHandler
      Role: !GetAtt LambdaExecutionRole.Arn
      Runtime: !Ref LambdaRuntime
      Code:
        S3Bucket: !Ref LambdaS3Bucket
        S3Key: !Ref LambdaS3Key
  LambdaExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  
  # API Gateway
  ApiGateway:
    Type: AWS::ApiGateway::RestApi
    Properties:
      Name: call-assistant-api
      Description: Call Assistant API Gateway
      EndpointConfiguration:
        Types:
          - REGIONAL
  
  ApiGatewayResource:
    Type: AWS::ApiGateway::Resource
    Properties:
      RestApiId: !Ref ApiGateway
      ParentId: !GetAtt ApiGateway.RootResourceId
      PathPart: "{proxy+}"
  
  ApiGatewayMethod:
    Type: AWS::ApiGateway::Method
    Properties:
      RestApiId: !Ref ApiGateway
      ResourceId: !Ref ApiGatewayResource
      HttpMethod: ANY
      AuthorizationType: NONE
      Integration:
        Type: AWS_PROXY
        IntegrationHttpMethod: POST
        Uri: !Sub "arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${BackendFunction.Arn}/invocations"
  
  ApiGatewayRootMethod:
    Type: AWS::ApiGateway::Method
    Properties:
      RestApiId: !Ref ApiGateway
      ResourceId: !GetAtt ApiGateway.RootResourceId
      HttpMethod: ANY
      AuthorizationType: NONE
      Integration:
        Type: AWS_PROXY
        IntegrationHttpMethod: POST
        Uri: !Sub "arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${BackendFunction.Arn}/invocations"
  
  ApiGatewayDeployment:
    Type: AWS::ApiGateway::Deployment
    DependsOn: 
      - ApiGatewayMethod
      - ApiGatewayRootMethod
    Properties:
      RestApiId: !Ref ApiGateway
      StageName: prod
  
  LambdaApiGatewayPermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !GetAtt BackendFunction.Arn
      Action: lambda:InvokeFunction
      Principal: apigateway.amazonaws.com
      SourceArn: !Sub "arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${ApiGateway}/*/*"
  
  FrontendBucket:
    Type: AWS::S3::Bucket
    Properties:
      WebsiteConfiguration:
        IndexDocument: index.html
        ErrorDocument: error.html
      PublicAccessBlockConfiguration:
        BlockPublicAcls: false
        BlockPublicPolicy: false
        IgnorePublicAcls: false
        RestrictPublicBuckets: false
  FrontendBucketPolicy:
    Type: AWS::S3::BucketPolicy
    DependsOn: FrontendBucket
    Properties:
      Bucket: !Ref FrontendBucket
      PolicyDocument:
        Statement:
          - Effect: Allow
            Principal: "*"
            Action: "s3:GetObject"
            Resource: !Sub "arn:aws:s3:::${FrontendBucket}/*"
  FrontendDistribution:
    Type: AWS::CloudFront::Distribution
    DependsOn: FrontendBucket
    Properties:
      DistributionConfig:
        Enabled: true
        Origins:
          - Id: frontend
            DomainName: !Sub "${FrontendBucket}.s3-website-${AWS::Region}.amazonaws.com"
            CustomOriginConfig:
              HTTPPort: 80
              HTTPSPort: 443
              OriginProtocolPolicy: http-only
        DefaultCacheBehavior:
          TargetOriginId: frontend
          ViewerProtocolPolicy: redirect-to-https
          AllowedMethods: [GET, HEAD, OPTIONS]
          CachedMethods: [GET, HEAD]
          ForwardedValues:
            QueryString: false
            Cookies:
              Forward: none
          Compress: true

Outputs:
  FrontendBucketName:
    Description: Name of the S3 bucket for frontend hosting
    Value: !Ref FrontendBucket
    Export:
      Name: !Sub "${AWS::StackName}-FrontendBucket"
  
  FrontendDistributionId:
    Description: CloudFront Distribution ID
    Value: !Ref FrontendDistribution
    Export:
      Name: !Sub "${AWS::StackName}-FrontendDistributionId"
  
  FrontendDistributionDomain:
    Description: CloudFront Distribution Domain Name
    Value: !GetAtt FrontendDistribution.DomainName
    Export:
      Name: !Sub "${AWS::StackName}-FrontendDistributionDomain"
  
  LambdaFunctionArn:
    Description: Lambda Function ARN
    Value: !GetAtt BackendFunction.Arn
    Export:
      Name: !Sub "${AWS::StackName}-LambdaArn"
  
  ApiGatewayUrl:
    Description: API Gateway endpoint URL
    Value: !Sub "https://${ApiGateway}.execute-api.${AWS::Region}.amazonaws.com/prod"
    Export:
      Name: !Sub "${AWS::StackName}-ApiGatewayUrl"
"""

    # Combine sections into complete template
    template = f"""AWSTemplateFormatVersion: '2010-09-09'
Description: Call Assistant Deployment
{parameters_section}

{resources_section}"""
    
    return template


if __name__ == "__main__":
    print(generate_cloudformation())
