/******************************************************************************* 
 * Copyright (c) 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

define(['dojo', 'orion/serviceregistry', 'orion/preferences', 'orion/pluginregistry', 'orion/status',  'orion/commands',
	        'orion/searchClient', 'orion/globalCommands', 'orion/git/gitClient', 'orion/git/git-status-table', 'orion/breadcrumbs','orion/dialogs','orion/ssh/sshTools',
	        'dojo/parser', 'dojo/hash', 'dijit/layout/BorderContainer', 'dijit/layout/ContentPane'], 
			function(dojo, mServiceregistry, mPreferences, mPluginRegistry, mStatus, mCommands, mSearchClient, mGlobalCommands, mGitClient, mGitStatusTable, mBreadcrumbs,mDialogs,mSshTools) {

	dojo.addOnLoad(function() {
		document.body.style.visibility = "visible";
		dojo.parser.parse();
		// initialize service registry and EAS services
		var serviceRegistry = new mServiceregistry.ServiceRegistry();
		var pluginRegistry = new mPluginRegistry.PluginRegistry(serviceRegistry);
		var commandService = new mCommands.CommandService({serviceRegistry: serviceRegistry});
		var preferenceService = new mPreferences.PreferencesService(serviceRegistry, "/prefs/user");
		var searcher = new mSearchClient.Searcher({serviceRegistry: serviceRegistry});
		// Git operations
		new mGitClient.GitService(serviceRegistry);
		new mSshTools.SshService(serviceRegistry);
		// File operations
	
		new mDialogs.DialogService(serviceRegistry);
		
		var statusService = new mStatus.StatusReportingService(serviceRegistry, "statusPane", "notifications");
	
		mGlobalCommands.generateBanner("toolbar", serviceRegistry, commandService, preferenceService, searcher);
	
		var controller = new mGitStatusTable.GitStatusController({renderLog :true},serviceRegistry , commandService , statusService,"unstagedZone" , "stagedZone");
		controller.getGitStatus(dojo.hash(),true);
	
		//every time the user manually changes the hash, we need to load the git status
		dojo.subscribe("/dojo/hashchange", controller, function() {
			controller.getGitStatus(dojo.hash(),true);
		});
		
	});

});


