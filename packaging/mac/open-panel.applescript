-- Opens the Charlottendal TKL panel as its own window. Chrome is used when it is
-- installed, because the Stream Deck needs WebHID; otherwise the default browser.
set panelURL to "http://127.0.0.1:8910/#panel"
try
	do shell script "open -na 'Google Chrome' --args --app=" & quoted form of panelURL
on error
	try
		do shell script "open -na 'Microsoft Edge' --args --app=" & quoted form of panelURL
	on error
		open location panelURL
	end try
end try
