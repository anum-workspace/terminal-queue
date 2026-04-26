#!/bin/bash
########################################################################
#              author:    Anum Hosen                                   #
#              email:     anumhosen@gmail.com                          #
#----------------------------------------------------------------------#
#                         Dept. of Physics                             #
#           Jashore University of Science and Technology               #
########################################################################
set -e
source /usr/local/gromacs/bin/GMXRC

# Energy Minimization
gmx grompp -f step6.0_minimization.mdp \
           -o step6.0_minimization.tpr \
           -c step5_input.gro \
           -r step5_input.gro \
           -p topol.top \
           -n index.ndx
           
gmx mdrun -v -deffnm step6.0_minimization -ntmpi 2 -ntomp 16
