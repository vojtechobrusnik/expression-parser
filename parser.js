const parser = (function() {

	let parser = {};


	parser.ParserError = function(message) {
		this.message = message || '';
	};


	parser.SyntaxError = function(token) {
		this.message = 'Syntax Error.';
		let location = ' Something is missing or wrongly placed ';

		if (token instanceof Token) {
			this.message += location + 'before the token: '
				+ JSON.stringify(token.data);
		} else if (token instanceof Mark) {
			this.message += location + 'in the end of a statement.';
		}
	};


	let TokenType = {
		BRACKET: {
			LEFT: '(',
			RIGHT: ')'
		},
		AND: '&',
		OR: '|',
		ID: '_id_'
	};

	TokenType.guess = function (data) {
		if ((Object.values(TokenType).indexOf(data) !== -1)
			|| (Object.values(TokenType.BRACKET).indexOf(data) !== -1)
		) {
			return data;
		}

		return TokenType.ID;
	};

	function Token(data) {
		this.data = data;
		this.type = TokenType.guess(data);
	}


	let MarkType = {
		END: '_end_',
		RULE: '_rule_'
	};

	function Mark(type) {
		this.type = type;
	}


	function Table() {
		this.map = [
			TokenType.AND, TokenType.OR, TokenType.BRACKET.LEFT, TokenType.BRACKET.RIGHT, TokenType.ID, MarkType.END
		];
		this.table = [
			['>', '>', '<', '>', '<', '>'],
			['>', '>', '<', '>', '<', '>'],
			['<', '<', '<', '=', '<', '' ],
			['>', '>', '' , '>', '' , '>'],
			['>', '>', '' , '>', '' , '>'],
			['<', '<', '<', '' , '<', '' ],
		];
	}

	Table.prototype.read = function (stack, input) {
		let map = function (item) {
			return ((item instanceof Token) || (item instanceof Mark)) ? item.type : '';
		};

		let row = this.map.indexOf(map(stack));
		let column = this.map.indexOf(map(input));
		let cell;

		if ((row === -1) || (column === -1)) {
			return '';
		}

		try {
			cell = this.table[row][column];
			return cell;
		} catch (e) {
			return '';
		}
	};


	function Rule(items, translation) {
		if (!(items instanceof Array)) {
			throw new parser.ParserError('\'items\' should be an instance of Array.');
		}

		if (translation && !(translation instanceof Array)) {
			throw new parser.ParserError('\'translation\' should be an instance of Array.');
		}

		this.items = [];
		this.translation = translation || [];

		for (let i = 0; i < items.length; i++) {
			if ((items[i] instanceof Token) || (items[i] instanceof Rule)) {
				this.items.push(items[i]);
			} else {
				this.items.push(new Token(items[i]));
			}
		}
	}

	Rule.prototype.export = function () {
		let output = [];

		for (let i = 0; i < this.translation.length; i++) {
			let j = this.translation[i];

			if (this.items[j] instanceof Token) {
				output.push(this.items[j].data);
			} else if (this.items[j] instanceof Rule) {
				output = output.concat(this.items[j].export());
			}
		}

		return output;
	};

	Rule.prototype.match = function (rule) {
		if (!(rule instanceof Rule)) {
			return false;
		}

		if (this.items.length !== rule.items.length) {
			return false;
		}

		for (let i = 0; i < this.items.length; i++) {
			if ((this.items[i] instanceof Token)
				&& (rule.items[i] instanceof Token)
				&& (this.items[i].type !== rule.items[i].type)
			) {
				return false;
			} else if ((this.items[i] instanceof Token)
				&& (rule.items[i] instanceof Rule)
				&& (this.items[i].type !== TokenType.ID)
			) {
				return false;
			} else if ((this.items[i] instanceof Rule)
				&& (rule.items[i] instanceof Token)
				&& (rule.items[i].type !== TokenType.ID)
			) {
				return false;
			} else if ((this.items[i] instanceof Rule)
				&& (rule.items[i] instanceof Rule)
				&& !this.items[i].match(rule.items[i])
			) {
				return false;
			}
		}

		return true;
	};


	function RuleSet() {
		this.rules = [];
	}

	RuleSet.prototype.add = function (rule) {
		if (!(rule instanceof Rule)) {
			throw new parser.ParserError('\'rule\' should be an instance of Rule.');
		}

		this.rules.push(rule);

		return this;
	};

	RuleSet.prototype.find = function (rule) {
		if (!(rule instanceof Rule)) {
			throw new parser.ParserError('\'rule\' should be an instance of Rule.');
		}

		for (let i = 0; i < this.rules.length; i++) {
			if (this.rules[i].match(rule)) {
				return this.rules[i];
			}
		}

		return null;
	};


	function Stack() {
		this.stack = [];
	}

	Stack.prototype.isEmpty = function () {
		return this.stack.length < 1;
	};

	Stack.prototype.push = function (item) {
		this.stack.push(item);
	};

	Stack.prototype.pop = function () {
		if (this.isEmpty()) {
			return null;
		}

		return this.stack.pop();
	};

	Stack.prototype.readTerminal = function () {
		if (this.isEmpty()) {
			return null;
		}

		for (let i = this.stack.length - 1; i >= 0; i--) {
			if (this.stack[i] instanceof Token) {
				return this.stack[i];
			} else if ((this.stack[i] instanceof Mark)
				&& (this.stack[i].type === MarkType.END)
			) {
				return this.stack[i];
			}
		}

		return null;
	};

	Stack.prototype.pushRuleMark = function () {
		if (this.isEmpty()) {
			return;
		}

		let mark = new Mark(MarkType.RULE);

		for (let i = this.stack.length - 1; i >= 0; i--) {
			if (this.stack[i] instanceof Token) {
				this.stack.splice(i + 1, 0, mark);
				return;
			} else if ((this.stack[i] instanceof Mark)
				&& (this.stack[i].type === MarkType.END)
			) {
				this.stack.splice(i + 1, 0, mark);
				return;
			}
		}
	};

	Stack.prototype.readRule = function () {
		if (this.isEmpty()) {
			return null;
		}

		for (let i = this.stack.length - 1; i >= 0; i--) {
			if ((this.stack[i] instanceof Mark)
				&& (this.stack[i].type === MarkType.RULE)
			) {
				let items = this.stack.slice(i + 1);
				return new Rule(items);
			}
		}

		return null;
	};

	Stack.prototype.replaceRule = function (rule) {
		if (!(rule instanceof Rule)) {
			throw new parser.ParserError('\'rule\' should be an instance of Rule.');
		}

		if (this.isEmpty()) {
			return;
		}

		for (let i = this.stack.length - 1; i >= 0; i--) {
			if ((this.stack[i] instanceof Mark)
				&& (this.stack[i].type === MarkType.RULE)
			) {
				this.stack.splice(i, this.stack.length, rule);
				return;
			}
		}
	};


	let rules = new RuleSet();

	rules.add(new Rule([TokenType.ID, TokenType.AND, TokenType.ID], [0, 2, 1]))
		 .add(new Rule([TokenType.ID, TokenType.OR, TokenType.ID], [0, 2, 1]))
		 .add(new Rule([TokenType.BRACKET.LEFT, TokenType.ID, TokenType.BRACKET.RIGHT], [1]))
		 .add(new Rule([TokenType.ID], [0]));


	let stack;


	let table = new Table();


	function analyze(input) {
		if (!(input instanceof Array)) {
			throw new parser.ParserError('\'input\' should be an instance of Array.');
		}

		let s, i, t, last_i;
		let rule, pattern;

		i = input.shift();

		while(1) {
			s = stack.readTerminal();
			t = table.read(s, i);
			last_i = i;

			if (((s instanceof Mark) && (s.type === MarkType.END))
				&& ((i instanceof Mark) && (i.type === MarkType.END))
			) {
				break;
			}

			if (t === '=') {
				stack.push(i);
				i = input.shift();
			} else if (t === '<') {
				stack.pushRuleMark();
				stack.push(i);
				i = input.shift();
			} else if (t === '>') {
				rule = stack.readRule();
				pattern = rules.find(rule);

				if ((rule instanceof Rule) && (pattern instanceof Rule)) {
					rule.translation = pattern.translation;
					stack.replaceRule(rule);
				} else {
					throw new parser.SyntaxError(last_i);
				}
			} else {
				throw new parser.SyntaxError(last_i);
			}
		}

		rule = stack.pop();

		return (rule instanceof Rule) ? rule : null;
	}


	parser.run = function (expression) {
		if (!(expression instanceof Array)) {
			throw new parser.ParserError('\'expression\' should be an instance of Array.');
		}

		let input = [];
		let rule;
		stack = new Stack();
		stack.push(new Mark(MarkType.END));

		for (let i = 0; i < expression.length; i++) {
			input.push(new Token(expression[i]));
		}

		input.push(new Mark(MarkType.END));

		rule = analyze(input);

		if (rule === null) {
			throw new parser.ParserError('Unexpected happen.');
		}

		return rule.export();
	};


	return parser;

})();

export { parser };
