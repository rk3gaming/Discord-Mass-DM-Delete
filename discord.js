/**
 * WHAT IS THIS?
 * Discord Mass DM Deletion Script
 * Optimized for deleting up to 15k messages
 * with improved rate limit handling and progress tracking
 * 
 * INSTRUCTIONS:
 * 1. Open Discord in your web browser
 * 2. Navigate to the DMs of the user that you want to delete your messages with
 * 3. Open browser developer console (Ctrl+Shift+I then go to "Console")
 * 4. Paste this script and press Enter
 * 5. Follow the prompts to confirm deletion
 * 
 * NOTE: This script only works for your own messages (you cannot delete the other persons messages)
 * NOTE: This script isn't some shady tool to pull discord tokens... Review the code before using. This was made for personal use!
 * NOTE: And remember use responsibly and at your own risk.
 */

(async function() {
    const statusDiv = document.createElement('div');
    statusDiv.style = 'position:fixed;top:10px;right:10px;background:rgba(0,0,0,0.8);color:white;padding:10px;z-index:9999;border-radius:5px;font-family:monospace;width:300px;';
    document.body.appendChild(statusDiv);
    
    function updateStatus(message, progress = null) {
      console.log(message);
      let statusText = message;
      if (progress !== null) {
        const progressBar = '█'.repeat(Math.floor(progress * 20)) + '░'.repeat(20 - Math.floor(progress * 20));
        statusText += `<br><br>${progressBar} ${Math.floor(progress * 100)}%`;
      }
      statusDiv.innerHTML = statusText;
    }
    
    const confirmation = confirm("This will delete YOUR messages in the current DM channel.\nThis action cannot be undone.\nProceed?");
    if (!confirmation) {
      updateStatus("Operation cancelled by user.");
      setTimeout(() => statusDiv.remove(), 3000);
      return;
    }
    
    const channelId = window.location.pathname.split('/').pop();
    if (!channelId || !channelId.match(/^\d+$/)) {
      updateStatus("Please navigate to the DM with the user first.");
      setTimeout(() => statusDiv.remove(), 5000);
      return;
    }
    
    updateStatus("Starting deletion process...<br>Channel ID: " + channelId);
    
    let token;
    try {
      token = (webpackChunkdiscord_app.push([[''],{},e=>{m=[];for(let c in e.c)m.push(e.c[c])}]),m).find(m=>m?.exports?.default?.getToken).exports.default.getToken();
    } catch (e) {
      try {
        token = document.body.appendChild(document.createElement('iframe')).contentWindow.localStorage.token.replace(/"/g, '');
      } catch (e2) {
        updateStatus("Could not get authorization token. Please make sure you're logged in.");
        setTimeout(() => statusDiv.remove(), 5000);
        return;
      }
    }
    
    if (!token) {
      updateStatus("Could not get authorization token. Please make sure you're logged in.");
      setTimeout(() => statusDiv.remove(), 5000);
      return;
    }
    
    let currentUserId;
    try {
      currentUserId = (webpackChunkdiscord_app.push([[''],{},e=>{m=[];for(let c in e.c)m.push(e.c[c])}]),m).find(m=>m?.exports?.default?.getCurrentUser).exports.default.getCurrentUser().id;
    } catch (e) {
      updateStatus("Could not determine your user ID. Please try reloading Discord.");
      setTimeout(() => statusDiv.remove(), 5000);
      return;
    }
    
    let deletedCount = 0;
    let processedCount = 0;
    let totalMessagesFound = 0;
    let lastMessageId = null;
    const batchSize = 100; 
    
    let baseDelay = 350; 
    let consecutiveErrors = 0;
    let rateLimitedCount = 0;
    
    updateStatus("Scanning for messages...");
    let estimatedTotal = 0;
    let scanComplete = false;
    let scanLastMessageId = null;
    
    while (!scanComplete && estimatedTotal < 20000) { 
      try {
        let url = `https://discord.com/api/v9/channels/${channelId}/messages?limit=${batchSize}`;
        if (scanLastMessageId) {
          url += `&before=${scanLastMessageId}`;
        }
        
        const response = await fetch(url, {
          headers: {
            'Authorization': token,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          if (response.status === 429) {
            const rateLimitData = await response.json();
            const waitTime = (rateLimitData.retry_after || 2) * 1000;
            updateStatus(`Rate limited during scan. Waiting ${waitTime/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, waitTime + 500));
            continue;
          } else {
            throw new Error(`API Error: ${response.status}`);
          }
        }
        
        const messages = await response.json();
        
        if (messages.length === 0) {
          scanComplete = true;
          continue;
        }
        
        scanLastMessageId = messages[messages.length - 1].id;
        
        const userMessages = messages.filter(msg => msg.author.id === currentUserId);
        estimatedTotal += userMessages.length;
        
        updateStatus(`Scanning: Found approximately ${estimatedTotal} messages to delete...`);
        
        if (messages.length < batchSize) {
          scanComplete = true;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error("Error during scan:", error);
        updateStatus(`Error during scan: ${error.message}<br>Continuing with deletion anyway...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        break;
      }
    }
    
    updateStatus(`Found approximately ${estimatedTotal} messages to delete. Starting deletion...`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    while (true) {
      try {
        let url = `https://discord.com/api/v9/channels/${channelId}/messages?limit=${batchSize}`;
        if (lastMessageId) {
          url += `&before=${lastMessageId}`;
        }
        
        const response = await fetch(url, {
          headers: {
            'Authorization': token,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          if (response.status === 429) {
            const rateLimitData = await response.json();
            const waitTime = (rateLimitData.retry_after || 2) * 1000;
            updateStatus(`Rate limited. Waiting ${waitTime/1000}s...<br>Deleted: ${deletedCount}/${estimatedTotal || '?'}`, estimatedTotal ? deletedCount/estimatedTotal : null);
            await new Promise(resolve => setTimeout(resolve, waitTime + 500));
            baseDelay = Math.min(baseDelay * 1.1, 1000);
            rateLimitedCount++;
            continue;
          } else {
            throw new Error(`API Error: ${response.status}`);
          }
        }
        
        const messages = await response.json();
        totalMessagesFound += messages.length;
        
        if (messages.length === 0) {
          break;
        }
        
        lastMessageId = messages[messages.length - 1].id;
        
        const userMessages = messages.filter(msg => msg.author.id === currentUserId);
        processedCount += messages.length;
        
        for (const message of userMessages) {
          try {
            updateStatus(`Deleting message ${message.id}...<br>Progress: ${deletedCount}/${estimatedTotal || '?'} deleted`, estimatedTotal ? deletedCount/estimatedTotal : null);
            
            const deleteResponse = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages/${message.id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': token
              }
            });
            
            if (deleteResponse.status === 429) {
              const rateLimitData = await deleteResponse.json();
              const waitTime = (rateLimitData.retry_after || 2) * 1000;
              updateStatus(`Rate limited. Waiting ${waitTime/1000}s...<br>Deleted: ${deletedCount}/${estimatedTotal || '?'}`, estimatedTotal ? deletedCount/estimatedTotal : null);
              await new Promise(resolve => setTimeout(resolve, waitTime + 500));
              
              baseDelay = Math.min(baseDelay * 1.2, 2000);
              rateLimitedCount++;
              continue;
            }
            
            if (!deleteResponse.ok && deleteResponse.status !== 404) {
              console.error(`Failed to delete message ${message.id}: ${deleteResponse.status}`);
              consecutiveErrors++;
              
              if (consecutiveErrors > 3) {
                baseDelay = Math.min(baseDelay * 1.5, 3000);
                updateStatus(`Multiple errors encountered. Increasing delay to ${baseDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                consecutiveErrors = 0;
              }
            } else {
              deletedCount++;
              consecutiveErrors = 0;
              
              if (deletedCount % 50 === 0 && rateLimitedCount < 5) {
                baseDelay = Math.max(baseDelay * 0.9, 300);
                rateLimitedCount = 0;
              }
            }

            const currentDelay = baseDelay + (Math.random() * 200);
            await new Promise(resolve => setTimeout(resolve, currentDelay));
            
          } catch (error) {
            console.error(`Error deleting message ${message.id}:`, error);
            await new Promise(resolve => setTimeout(resolve, baseDelay * 2));
          }
        }
        
        if (messages.length < batchSize) {
          break;
        }
        
      } catch (error) {
        console.error("Error fetching messages:", error);
        updateStatus(`Error: ${error.message}<br>Retrying in 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    updateStatus(`Deletion complete!<br>${deletedCount} messages were deleted.<br>This window will close in 10 seconds.`);
    console.log(`Deletion complete. ${deletedCount} messages were deleted.`);
    setTimeout(() => statusDiv.remove(), 10000);
  })();