/**
 * watsonx.ai SDK client with IAM authentication and token caching
 */

// Token cache with 5-minute expiry buffer
let tokenCache = {
  token: null,
  expiresAt: 0,
};

const TOKEN_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry

/**
 * Get IAM access token (cached with auto-refresh)
 */
async function getAccessToken(apiKey) {
  const now = Date.now();

  // Return cached token if still valid
  if (tokenCache.token && now < tokenCache.expiresAt - TOKEN_BUFFER_MS) {
    return tokenCache.token;
  }

  console.log('[watsonx] Refreshing IAM token...');

  const response = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${apiKey}`,
  });

  if (!response.ok) {
    throw new Error(`IAM token request failed: ${response.status}`);
  }

  const data = await response.json();

  // Cache token with expiry
  tokenCache = {
    token: data.access_token,
    expiresAt: now + (data.expires_in * 1000),
  };

  console.log('[watsonx] IAM token refreshed, expires in', data.expires_in, 'seconds');
  return data.access_token;
}

/**
 * Call watsonx.ai text generation API
 *
 * @param {Object} options
 * @param {string} options.prompt - The prompt to send
 * @param {string} options.apiKey - IBM Cloud API key
 * @param {string} options.projectId - watsonx.ai project ID
 * @param {string} options.modelId - Model identifier
 * @param {Object} [options.parameters] - Generation parameters
 * @returns {Promise<string>} Generated text
 */
async function generateText({
  prompt,
  apiKey,
  projectId,
  modelId,
  parameters = {},
}) {
  const token = await getAccessToken(apiKey);

  const defaultParams = {
    decoding_method: 'greedy',
    max_new_tokens: 2048,
    temperature: 0.1,
    top_p: 1,
    repetition_penalty: 1.05,
    stop_sequences: [],
  };

  const requestBody = {
    model_id: modelId,
    input: prompt,
    project_id: projectId,
    parameters: { ...defaultParams, ...parameters },
  };

  const startTime = Date.now();

  const response = await fetch(
    'https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2024-05-31',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`watsonx.ai API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const elapsed = Date.now() - startTime;

  console.log(`[watsonx] Generated text in ${elapsed}ms, tokens: ${data.results?.[0]?.generated_token_count || 'unknown'}`);

  if (!data.results || data.results.length === 0) {
    throw new Error('watsonx.ai returned empty results');
  }

  return data.results[0].generated_text;
}

/**
 * Call watsonx.ai chat API (for conversational use cases)
 *
 * @param {Object} options
 * @param {Array<{role: string, content: string}>} options.messages - Chat messages
 * @param {string} options.apiKey - IBM Cloud API key
 * @param {string} options.projectId - watsonx.ai project ID
 * @param {string} options.modelId - Model identifier
 * @param {Object} [options.parameters] - Generation parameters
 * @returns {Promise<string>} Assistant response
 */
async function chat({
  messages,
  apiKey,
  projectId,
  modelId,
  parameters = {},
}) {
  const token = await getAccessToken(apiKey);

  const defaultParams = {
    max_tokens: 2048,
    temperature: 0.3,
    top_p: 0.95,
    frequency_penalty: 0.1,
  };

  const requestBody = {
    model_id: modelId,
    messages,
    project_id: projectId,
    ...{ ...defaultParams, ...parameters },
  };

  const startTime = Date.now();

  const response = await fetch(
    'https://us-south.ml.cloud.ibm.com/ml/v1/text/chat?version=2024-05-31',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`watsonx.ai chat API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const elapsed = Date.now() - startTime;

  console.log(`[watsonx] Chat response in ${elapsed}ms`);

  if (!data.choices || data.choices.length === 0) {
    throw new Error('watsonx.ai chat returned empty choices');
  }

  return data.choices[0].message.content;
}

module.exports = {
  generateText,
  chat,
  getAccessToken,
};
