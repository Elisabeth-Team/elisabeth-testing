exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  const response = {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      message: 'Hello from Lambda 1!',
      requestId: event.requestContext?.requestId,
      path: event.path,
      method: event.httpMethod,
    }),
  };
  
  return response;
};