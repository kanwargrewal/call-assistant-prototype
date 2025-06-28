import os


def generate_cloudformation():
    bucket = os.environ.get("LAMBDA_S3_BUCKET", "my-bucket")
    key = os.environ.get("LAMBDA_S3_KEY", "lambda.zip")
    handler = os.environ.get("LAMBDA_HANDLER", "main.handler")
    runtime = os.environ.get("LAMBDA_RUNTIME", "python3.10")
    origin = os.environ.get("CLOUDFRONT_ORIGIN_DOMAIN", "example.com")

    template = f"""
AWSTemplateFormatVersion: '2010-09-09'
Description: Call Assistant Deployment
Resources:
  BackendFunction:
    Type: AWS::Lambda::Function
    Properties:
      Handler: {handler}
      Role: !GetAtt LambdaExecutionRole.Arn
      Runtime: {runtime}
      Code:
        S3Bucket: {bucket}
        S3Key: {key}
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
  FrontendDistribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Enabled: true
        Origins:
          - Id: frontend
            DomainName: {origin}
            CustomOriginConfig:
              OriginProtocolPolicy: https-only
        DefaultCacheBehavior:
          TargetOriginId: frontend
          ViewerProtocolPolicy: redirect-to-https
          AllowedMethods: [GET, HEAD, OPTIONS]
          CachedMethods: [GET, HEAD]
"""
    return template


if __name__ == "__main__":
    print(generate_cloudformation())
