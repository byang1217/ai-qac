async function llmChat(apiUrl, apiKey, apiModel, prompts, temperature=1.0) {
    console.log(`llm_chat, apiUrl:${apiUrl}, apiModel:${apiModel}, temperature:${temperature}, prompts:`, prompts);
    const requests = [];
    prompts.forEach((prompt, index) => {
        const req = fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: apiModel,
                messages: [
                    {
                        role: "user",
                        content: `${prompt}`
                    }
                ],
                temperature: temperature
            })
        }).then(response => {
            if (!response.ok) {
                return response.json().then(error => {
                    throw new Error(error.error?.message || `API error: (${response.status})`);
                });
            }
            return response.json();
        }).then(data => {
            return data.choices[0].message.content
        }).catch(error => {
            console.error(`prompts[${index}] error:`, error);
            throw error;
        });
        requests.push(req);
    });
    const contents = await Promise.all(requests);
    return contents;
}

async function llmChatJson(apiUrl, apiKey, apiModel, prompts, temperature=1.0) {
    const jsonObjs = [];
    const contents = await llmChat(apiUrl, apiKey, apiModel, prompts, temperature);
    console.log("llmChat return contents:", contents);
    contents.forEach((content, index) => {
        try {
            const jsonObj = extractAndParseJSON(content);
            jsonObjs.push(jsonObj);
            console.log("llmChat get json:", jsonObjs);
        } catch (error) {
            jsonObjs.push(null);
            console.log("llmChat parse json error:", content);
        }
    });
    return jsonObjs;
}
