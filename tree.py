import os
def print_tree(startpath, max_level=4):
    exclude = set(['node_modules', 'venv', '.git', '__pycache__', '.pytest_cache', 'dist'])
    for root, dirs, files in os.walk(startpath):
        dirs[:] = [d for d in dirs if d not in exclude]
        level = root.replace(startpath, '').count(os.sep)
        if level > max_level: continue
        indent = ' ' * 4 * (level)
        print('{}{}/'.format(indent, os.path.basename(root) or '.'))
        subindent = ' ' * 4 * (level + 1)
        for f in files:
            print('{}{}'.format(subindent, f))
print_tree('.')
