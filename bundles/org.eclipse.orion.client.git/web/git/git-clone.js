/******************************************************************************* 
 * Copyright (c) 2010, 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
var eclipse;
/*global dojo dijit window eclipse serviceRegistry:true widgets alert*/
/*browser:true*/
define(['dojo', 'orion/serviceregistry', 'orion/preferences', 'orion/pluginregistry', 'orion/status', 'orion/commands',
        'orion/auth', 'orion/dialogs', 'orion/selection', 'orion/fileClient', 'orion/searchClient', 'orion/globalCommands', 'orion/git/gitClient',
        'orion/ssh/sshTools', 'orion/git/git-clone-details', 'orion/git/git-clones-explorer', 'orion/git/gitCommands',
	    'dojo/parser', 'dojo/hash', 'dijit/layout/BorderContainer', 'dijit/layout/ContentPane', 'orion/widgets/eWebBorderContainer'], 
		function(dojo, mServiceregistry, mPreferences, mPluginRegistry, mStatus, mCommands, mAuth, mDialogs, mSelection, mFileClient,
					mSearchClient, mGlobalCommands, mGitClient, mSshTools, mGitCloneDetails, mGitClonesExplorer, mGitCommands) {

dojo.addOnLoad(function() {
	document.body.style.visibility = "visible";
	dojo.parser.parse();
	
	// initialize service registry and EAS services
	serviceRegistry = new mServiceregistry.ServiceRegistry();
	var pluginRegistry = new mPluginRegistry.PluginRegistry(serviceRegistry);
	dojo.addOnUnload(function() {
		pluginRegistry.shutdown();
	});
	new mStatus.StatusReportingService(serviceRegistry, "statusPane", "notifications");
	new mDialogs.DialogService(serviceRegistry);
	var selection = new mSelection.Selection(serviceRegistry);
	new mSshTools.SshService(serviceRegistry);
	var preferenceService = new mPreferences.PreferencesService(serviceRegistry, "/prefs/user");
	var commandService = new mCommands.CommandService({serviceRegistry: serviceRegistry});
	
	// Git operations
	new mGitClient.GitService(serviceRegistry);
	
	var searcher = new mSearchClient.Searcher({serviceRegistry: serviceRegistry});

	// define the command contributions - where things appear, first the groups
	commandService.addCommandGroup("eclipse.gitGroup", 100, null, null, "pageActions");
	// git contributions
	commandService.registerCommandContribution("eclipse.cloneGitRepository", 100, "pageActions", "eclipse.gitGroup");
	commandService.registerCommandContribution("eclipse.initGitRepository", 101, "pageActions", "eclipse.gitGroup");
	
	commandService.addCommandGroup("eclipse.selectionGroup", 500, "More actions", null, "selectionTools");
	commandService.registerCommandContribution("eclipse.git.deleteClone", 1, "selectionTools", "eclipse.selectionGroup");
	
	commandService.addCommandGroup("eclipse.gitGroup2", 1000, "More");
	commandService.addCommandGroup("eclipse.gitGroup2.u1", 2000, null, "eclipse.gitGroup2");
	commandService.addCommandGroup("eclipse.gitGroup2.delete", 3000, null, "eclipse.gitGroup2");
	
	// clone actions
	commandService.registerCommandContribution("eclipse.openGitStatus", 100);
	commandService.registerCommandContribution("eclipse.openGitLogAll", 200, null, "eclipse.gitGroup2");
	commandService.registerCommandContribution("eclipse.openCloneContent", 300, null, "eclipse.gitGroup2");
	commandService.registerCommandContribution("eclipse.git.deleteClone", 400, null, "eclipse.gitGroup2/eclipse.gitGroup2.delete");
	
	// remote action
	commandService.registerCommandContribution("eclipse.addRemote", 100);
	commandService.registerCommandContribution("eclipse.removeRemote", 400, null, "eclipse.gitGroup2/eclipse.gitGroup2.delete");
	
	// branch actions
	commandService.registerCommandContribution("eclipse.addBranch", 100);
	commandService.registerCommandContribution("eclipse.checkoutBranch", 101);
	
	commandService.registerCommandContribution("eclipse.openGitLog", 200, null, "eclipse.gitGroup2");
	
	commandService.registerCommandContribution("eclipse.orion.git.fetch", 300, null, "eclipse.gitGroup2/eclipse.gitGroup2.u1");
	commandService.registerCommandContribution("eclipse.orion.git.merge", 301, null, "eclipse.gitGroup2/eclipse.gitGroup2.u1");
	commandService.registerCommandContribution("eclipse.orion.git.rebase", 302, null, "eclipse.gitGroup2/eclipse.gitGroup2.u1");
	commandService.registerCommandContribution("eclipse.orion.git.push", 303, null, "eclipse.gitGroup2/eclipse.gitGroup2.u1");
	commandService.registerCommandContribution("eclipse.orion.git.pushto", 304, null, "eclipse.gitGroup2/eclipse.gitGroup2.u1");
	commandService.registerCommandContribution("eclipse.orion.git.resetIndex", 305, null, "eclipse.gitGroup2/eclipse.gitGroup2.u1");
	
	commandService.registerCommandContribution("eclipse.removeBranch", 400, null, "eclipse.gitGroup2/eclipse.gitGroup2.delete");
	commandService.registerCommandContribution("eclipse.removeRemoteBranch", 400, null, "eclipse.gitGroup2/eclipse.gitGroup2.delete");
	
	// Clone details
	var cloneDetails = new mGitCloneDetails.CloneDetails({parent: "cloneDetailsPane", serviceRegistry: serviceRegistry, detailsPane: dijit.byId("orion.innerNavigator")});
	
	var explorer = new mGitClonesExplorer.GitClonesExplorer(serviceRegistry, /* selection */ null, cloneDetails, "clonesList", "pageActions"/*, "selectionTools"*/);
	mGlobalCommands.generateBanner("toolbar", serviceRegistry, commandService, preferenceService, searcher, explorer);
	
	var fileClient = new mFileClient.FileClient(serviceRegistry, function(reference) {
		var pattern = reference.getProperty("pattern");
		return pattern && pattern.indexOf("/") === 0;
	});
	
	fileClient.loadWorkspace().then(
		function(workspace){
			explorer.setDefaultPath(workspace.Location);
	
			// global commands
			mGitCommands.createFileCommands(serviceRegistry, commandService, explorer, "pageActions", "selectionTools");
			mGitCommands.createGitClonesCommands(serviceRegistry, commandService, explorer, "pageActions", "selectionTools", fileClient);
	
			mGitCommands.updateNavTools(serviceRegistry, explorer, "pageActions", "selectionTools", {});
	
			explorer.displayClonesList(dojo.hash());
				
			//every time the user manually changes the hash, we need to load the workspace with that name
			dojo.subscribe("/dojo/hashchange", explorer, function() {
			   explorer.displayClonesList(dojo.hash());
			});

		}
	);
		
	
	makeRightPane(navigator);
});

function makeRightPane(explorer){
	// set up the splitter bar and its key binding
	var splitArea = dijit.byId("orion.innerNavigator");
	
	//by default the pane should be closed
	if(splitArea.isRightPaneOpen()){
		splitArea.toggle();
	}
			
	var bufferedSelection = [];
	
	window.document.onkeydown = function (evt){
		evt = evt || window.event;
		var handled = false;
		if(evt.ctrlKey && evt.keyCode  === 79){ // Ctrl+o handler for toggling outline 
			splitArea.toggle();
			handled = true;			
		} 
		if (handled) {
			if (window.document.all) { 
				evt.keyCode = 0;
			} else { 
				evt.preventDefault();
				evt.stopPropagation();
			}		
		}
	};
}

});
