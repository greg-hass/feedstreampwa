export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["favicon.png","icons/icon-192.png","icons/icon-512.png","manifest.webmanifest","sw.js"]),
	mimeTypes: {".png":"image/png",".webmanifest":"application/manifest+json",".js":"text/javascript"},
	_: {
		client: {start:"_app/immutable/entry/start.Q6asvDLW.js",app:"_app/immutable/entry/app.DLRbqx0R.js",imports:["_app/immutable/entry/start.Q6asvDLW.js","_app/immutable/chunks/BcuW2uiN.js","_app/immutable/chunks/CM6ZlorT.js","_app/immutable/entry/app.DLRbqx0R.js","_app/immutable/chunks/CM6ZlorT.js","_app/immutable/chunks/wNy-qeCD.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js'))
		],
		remotes: {
			
		},
		routes: [
			
		],
		prerendered_routes: new Set(["/"]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
