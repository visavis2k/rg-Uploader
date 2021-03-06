/**
 * Uploader component
 */

const fileUpload = require('FileUpload.js');
const util = require('./Util.js');
const lang = require('./Language.js');


// export
module.exports = function Uploader(parent) {

	/**
	 * @var {String} component name
	 */
	this.name = 'Uploader';

	/**
	 * @var {Queue} queue
	 */
	this.queue = parent.queue;

	/**
	 * @var {Object} upload elements
	 */
	this.$uploadElement = null;

	/**
	 * @var {Array} this.readyItems
	 */
	this.readyItems = [];

	/**
	 * @var {Boolean} uploading
	 */
	this.uploading = false;


	/**
	 * get total ready items size
	 *
	 * @Param {Array} items
	 * @Return {int}
	 */
	var getTotalReadySize = (items) => {
		var size = 0;
		for (let i=0; i<items.length; i++)
		{
			size += items[i].size;
		}
		return size;
	};

	/**
	 * merge file list
	 *
	 * @Param {Object} $el
	 * @Return {Array}
	 */
	var mergeFileList = ($el) => {
		var files = [];
		$el.each((k, o) => {
			for (let i=0; i<o.files.length; i++)
			{
				files.push(o.files[i]);
			}
		});
		return files;
	};

	/**
	 * init event
	 */
	var initEvent = () => {

		var $startUpload = util.findDOM(parent.$container, 'element', 'startUpload');

		this.$uploadElement = util.findDOM(parent.$container, 'element', 'addfiles');
		this.addUploadElements(parent.options.$externalFileForm);

		if (!this.$uploadElement || !this.$uploadElement.length) return false;

		// init change event
		this.$uploadElement.each((k, o) => {
			$(o).on('change', (e) => {
				// check auto upload
				if (parent.options.autoUpload)
				{
					if (this.uploading)
					{
						alert(lang('error_add_upload'));
						this.resetEvent();
						return false;
					}

					// play upload
					this.play(this.$uploadElement, null);
				}
				else
				{
					if ($startUpload.length)
					{
						let count = mergeFileList(this.$uploadElement).length;
						if (count > 0)
						{
							$startUpload.removeClass('disabled');
						}
						else
						{
							$startUpload.addClass('disabled');
						}
					}
				}
			});
		});

		// init start upload button
		if ($startUpload.length)
		{
			$startUpload.addClass('disabled').on('click', (e) => {
				this.play(this.$uploadElement, null);
				$startUpload.addClass('disabled');
				return false;
			});
		}
	};

	/**
	 * push ready upload files
	 *
	 * @Param {Object} el [type=file] element
	 */
	var pushReadyUploadFiles = (files) => {
		let options = parent.options;
		let limitCount = options.queue.limit;
		let error = {
			type : false,
			extension : false,
			filesize : false
		};

		function actError(type, message)
		{
			if (error[type] == false)
			{
				alert(message);
				error[type] = true;
			}
		}

		// check file count
		if ((parent.queue.items.ids.length + files.length) > limitCount)
		{
			alert(lang('error_upload_limit', [options.queue.limit]));
			return false;
		}

		// check total upload size
		let size = parent.queue.getSize() + getTotalReadySize(this.readyItems) + getTotalReadySize(files);
		if (options.limitSizeTotal < size)
		{
			alert(lang('error_limit_size'));
			return false;
		}

		// check items and add items ready for upload
		for (let i=0; i<files.length; i++)
		{
			if (!files[i].type)
			{
				actError('type', lang('error_file_type'));
				continue;
			};

			// check file extension
			if (options.allowFileTypes.indexOf(files[i].type.split('/')[1]) < 0)
			{
				actError('extension', lang('error_check_file'));
				continue;
			}

			// check file size
			if (files[i].size > options.limitSize)
			{
				actError('filesize', lang('error_limit_size2'));
				continue;
			}

			// set unique id
			files[i].id = util.getUniqueNumber();

			// push upload item
			this.readyItems.push(files[i]);
		}

		this.readyItems.forEach((item) => {
			parent.queue.addProgress(item);
		});
	};


	/**
	 * play upload
	 *
	 * @Param {Object} $el
	 * @Param {FileList|Array} files
	 */
	this.play = ($el, files) => {

		let items = files || mergeFileList($el);

		if (!items.length)
		{
			alert(lang('error_not_upload_file'));
			return false;
		}

		// push upload items
		pushReadyUploadFiles(items);

		// reset form
		if ($el && !files)
		{
			this.resetEvent($el);
		}

		// start upload
		this.upload();
	}

	/**
	 * play upload
	 */
	this.upload = () => {
		if (!this.readyItems.length) return false;

		this.uploading = true;

		let script = parent.options.uploadScript || null;
		let upload = fileUpload(script, this.readyItems[0]);

		upload
			.done((response, file) => {
				this.uploadComplete('success', response, file);
			})
			.progress((response, file) => {
				this.uploadProgress(response, file);
			})
			.fail((message, file) => {
				this.uploadComplete('error', message, file);
			});
	};

	/**
	 * upload progress event
	 *
	 * @Param {Object} res
	 * @Param {File} file
	 */
	this.uploadProgress = (res, file) => {
		parent.queue.updateProgress({
			id : file.id,
			data : res
		});
		if (parent.options.uploadProgress)
		{
			parent.options.uploadProgress(res, file);
		}
	};

	/**
	 * upload complete event
	 *
	 * @Param {String} state (success|error)
	 * @Param {Object} res
	 * @Param {File} file
	 */
	this.uploadComplete = (state, res, file) => {
		switch(state) {
			case 'success':
				file = $.extend({}, file, res);
				delete file.slice;
				parent.queue.uploadResult('success', file);

				// callback
				if (parent.options.uploadComplete)
				{
					parent.options.uploadComplete(file);
				}
				break;
			case 'error':
				file.message = res;
				parent.queue.uploadResult('error', file);
				console.log(file.message);

				// callback
				if (parent.options.uploadFail)
				{
					parent.options.uploadFail(file);
				}
				break;
		}

		this.readyItems.splice(0, 1);

		// next upload
		if (this.readyItems.length)
		{
			this.upload();
		}
		else
		{
			this.uploading = false;
		}
	};

	/**
	 * add upload elements
	 *
	 * @Param {Object} $el
	 */
	this.addUploadElements = ($el) => {
		if (this.$uploadElement && this.$uploadElement.length)
		{
			this.$uploadElement = this.$uploadElement.add($el);
		}
		else
		{
			this.$uploadElement = $el;
		}
	};

	/**
	 * reset event
	 *
	 * @Param {Object} $el
	 */
	this.resetEvent = ($el) => {
		let $inputs = $el || this.$uploadElement;
		$inputs.each((k, o) => {
			util.inputFileReset(o);
		});
	}


	// ACTION
	initEvent();
};