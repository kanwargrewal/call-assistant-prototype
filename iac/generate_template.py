import os


def generate_cloudformation():
    # Default values - can be overridden by CloudFormation parameters
    default_bucket = os.environ.get("LAMBDA_S3_BUCKET", "my-bucket")
    default_key = os.environ.get("LAMBDA_S3_KEY", "lambda.zip")
    default_handler = os.environ.get("LAMBDA_HANDLER", "main.handler")
    default_runtime = os.environ.get("LAMBDA_RUNTIME", "python3.10")
    default_frontend_bucket = os.environ.get("FRONTEND_S3_BUCKET", "call-assistant-frontend-bucket")

    template = f"""
AWSTemplateFormatVersion: '2010-09-09'
Description: Call Assistant Deployment

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
  
  FrontendS3Bucket:
    Type: String
    Default: {default_frontend_bucket}
    Description: S3 bucket for frontend hosting

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
  FrontendBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Ref FrontendS3Bucket
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
            Resource: !Sub "${FrontendBucket}/*"
  FrontendDistribution:
    Type: AWS::CloudFront::Distribution
    DependsOn: FrontendBucket
    Properties:
      DistributionConfig:
        Enabled: true
        Origins:
          - Id: frontend
            DomainName: !GetAtt FrontendBucket.RegionalDomainName
            S3OriginConfig:
              OriginAccessIdentity: ""
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
"""
    return template


if __name__ == "__main__":
    print(generate_cloudformation())
